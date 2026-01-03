#include "VocoderProcessor.h"
#include <algorithm>
#include <cmath>

constexpr std::array<float, VocoderProcessor::kNumBands>
    VocoderProcessor::kBandFrequencies;

VocoderProcessor::VocoderProcessor(float sampleRate) : mSampleRate(sampleRate) {
  setupBands();

  // Filtro anti-acople (100Hz HPF) - igual que referencia
  mModHPF.setCoefficients(100.0f, 0.707f, sampleRate);

  // Inicializar smoothers con ~30ms como en referencia
  float tc = 30.0f;
  sIntensity.setTimeConstant(tc, sampleRate);
  sIntensity.setTarget(1.5f);            // Valor inicial de referencia
  sResonance = ParameterSmoother(18.0f); // Q=18 como referencia
  sResonance.setTimeConstant(tc, sampleRate);
  sNoiseThreshold.setTimeConstant(tc, sampleRate);
  sNoiseThreshold.setTarget(0.012f); // Valor inicial de referencia
  sMix.setTimeConstant(tc, sampleRate);
  sDiffusion.setTimeConstant(tc, sampleRate);

  mGlobalMod.setSampleRate(sampleRate);
}

void VocoderProcessor::setupBands() {
  // Q=18 como en referencia
  constexpr float Q = 18.0f;

  for (int i = 0; i < kNumBands; i++) {
    mBands[i].frequency = kBandFrequencies[i];
    mBands[i].modFilter.setCoefficients(kBandFrequencies[i], Q, mSampleRate);
    mBands[i].carFilter.setCoefficients(kBandFrequencies[i], Q, mSampleRate);
    mBands[i].envelope = EnvelopeFollower(mSampleRate);
    // EnvelopeFollower ya usa 2ms attack, 30ms release por defecto - perfecto
  }
}

void VocoderProcessor::process(const float *modulator, const float *carrier,
                               float *output, int numFrames) {
  for (int frame = 0; frame < numFrames; frame++) {
    float intensity = sIntensity.process();
    float resonance = sResonance.process();
    float threshold = sNoiseThreshold.process();
    float mix = sMix.process();

    // Actualizar Q das bandas se cambiou a resonancia significativamente
    if (std::abs(resonance - lastRes_) > 0.5f) {
      for (int i = 0; i < kNumBands; i++) {
        mBands[i].modFilter.setCoefficients(kBandFrequencies[i], resonance,
                                            mSampleRate);
        mBands[i].carFilter.setCoefficients(kBandFrequencies[i], resonance,
                                            mSampleRate);
      }
      lastRes_ = resonance;
    }

    // Actualizar release do envelope se cambiou a difusión
    float diffusion = sDiffusion.process();
    if (std::abs(diffusion - lastDiff_) > 0.02f) {
      // 0 = 15ms (moi definido), 1 = 150ms (moi difuso)
      float releaseMs = 15.0f + diffusion * 135.0f;
      for (int i = 0; i < kNumBands; i++) {
        mBands[i].envelope.setRelease(releaseMs);
      }
      lastDiff_ = diffusion;
    }

    // Modulador: Preamplificación (xa normalizado en Kotlin ao 90%)
    float modSample = modulator[frame] * 4.0f;

    // Aplicar HPF para quitar retumbo de graves que causa acople
    modSample = mModHPF.process(modSample);

    // Seguidor global para porta de ruído maestra
    float globalEnv = mGlobalMod.process(modSample);

    // Carrier (de otros motores)
    float carSample = carrier[frame];

    float vocodeOutput = 0.0f;

    // Porta maestra (se non hai voz global, silenciamos todo para evitar leak)
    float masterGate = 1.0f;
    if (globalEnv < threshold * 0.5f) {
      masterGate = 0.0f;
    } else if (globalEnv < threshold) {
      masterGate = (globalEnv - threshold * 0.5f) / (threshold * 0.5f);
    }

    if (masterGate > 0.0f) {
      // Vocoding: processo mellorado con gate suave e filtrado continuo
      for (auto &band : mBands) {
        float filteredMod = band.modFilter.process(modSample);
        float envelope = band.envelope.process(filteredMod);

        // SEMPRE procesamos o filtro da portadora para manter o seu estado
        float filteredCar = band.carFilter.process(carSample);

        // Porta de ruído suave (Soft Gate) por banda
        float gain = 0.0f;
        if (envelope > threshold) {
          gain = 1.0f;
        } else if (envelope >
                   threshold *
                       0.4f) { // Máis agresivo que antes (0.4 en lugar de 0.25)
          gain = (envelope - threshold * 0.4f) / (threshold * 0.6f);
          gain = gain * gain;
        }

        // Compensación de ganancia por resonancia (Q): máis Q = menos volume
        // sumado A resonancia baixa (bandas anchas) suma moita máis enerxía
        float qComp = 1.0f / (1.0f + std::max(0.0f, 25.0f - resonance) * 0.15f);
        vocodeOutput += filteredCar * envelope * intensity * gain * qComp;
      }
    } else {
      // Aínda que a porta estea pechada, procesamos os filtros da portadora
      // en "silencio" para que estean listos para a seguinte palabra
      for (auto &band : mBands) {
        band.carFilter.process(carSample);
        band.modFilter.process(modSample);
      }
    }

    // Normalización mellorada: 2.5f para que teña pegada e non se perda
    // (antes 1.0f)
    vocodeOutput *= (2.5f * masterGate);

    // Blend mellorado (Equal Power / Log-like)
    // mix=0: só carrier. mix=1: só vocoder
    float wetG, dryG;
    if (mix > 0.98f) {
      wetG = 1.0f;
      dryG = 0.0f;
    } else if (mix < 0.02f) {
      wetG = 0.0f;
      dryG = 1.0f;
    } else {
      // Curva moito máis "protectora" da moduladora (Vocoder)
      // O dry cae moito antes para que a voz siga sendo a protagonista
      // ata que realmente queiras moito carrier seco.
      wetG = std::pow(mix, 0.25f);       // Cae moi amodo dende 1.0
      dryG = std::pow(1.0f - mix, 1.5f); // O seco entra máis tarde e amodo
    }

    float finalOut = (vocodeOutput * wetG) + (carSample * dryG);

    // Soft-clipper mellorado (tanh) para un son máis analóxico
    if (finalOut > 0.8f) {
      finalOut = 0.8f + 0.2f * std::tanh((finalOut - 0.8f) * 5.0f);
    } else if (finalOut < -0.8f) {
      finalOut = -0.8f + 0.2f * std::tanh((finalOut + 0.8f) * 5.0f);
    }

    output[frame] = finalOut;
  }
}

void VocoderProcessor::setIntensity(float intensity) {
  // Rango como referencia: 0.2 a 4.0
  float val = 0.2f + intensity * 3.8f;
  sIntensity.setTarget(val);
}

void VocoderProcessor::setResonance(float resonance) {
  // Q de 10 a 25 (18 por defecto en referencia)
  sResonance.setTarget(10.0f + resonance * 15.0f);
}

void VocoderProcessor::setNoiseThreshold(float threshold) {
  // Limiar moito máis agresivo para que "Viscosidade" actúe de verdade
  // Rango: 0.005 a 0.5 (con pre-gain de 4x e sinal de 3.6, isto é ata o 14% do
  // pico)
  sNoiseThreshold.setTarget(0.005f + threshold * 0.495f);
}

void VocoderProcessor::setMix(float mix) {
  sMix.setTarget(std::clamp(mix, 0.0f, 1.0f));
}

void VocoderProcessor::setDiffusion(float diffusion) {
  // Controla o release do envelope: 0=definido, 1=difuso
  sDiffusion.setTarget(std::clamp(diffusion, 0.0f, 1.0f));
}

float VocoderProcessor::getModulatorRMS() {
  // Normalizamos o nivel para a UI (rango 0-1)
  // Cun pre-gain de 4x e sinal ao 90%, o pico anda por 3.6
  return std::clamp(mGlobalMod.getLevel() / 4.0f, 0.0f, 1.0f);
}
