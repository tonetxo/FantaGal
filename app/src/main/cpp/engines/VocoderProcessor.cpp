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

    // Modulador: Preamplificación (10x balanceado con normalización de Kotlin)
    float modSample = modulator[frame] * 10.0f;

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

        // Lóxica de Bias de Aethereum: expulsor de ruído natural
        // Protexemos mellor a enerxía do sobre orixinal
        float gain = (envelope - threshold * 0.4f) * intensity;
        if (gain < 0.0f)
          gain = 0.0f;

        vocodeOutput += filteredCar * gain;
      }
    } else {
      // Aínda que a porta estea pechada, procesamos os filtros da portadora
      // en "silencio" para que estean listos para a seguinte palabra
      for (auto &band : mBands) {
        band.carFilter.process(carSample);
        band.modFilter.process(modSample);
      }
    }

    // Normalización: 0.8f (conservador como en Aethereum para evitar "whisper"
    // por saturación)
    vocodeOutput *= (0.8f * masterGate);

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
  // Rango 12-22 (Aethereum usa 18). Máis de 22 soa moi "fino" e susurrado.
  sResonance.setTarget(12.0f + resonance * 10.0f);
}

void VocoderProcessor::setNoiseThreshold(float threshold) {
  // Limiar máis próximo a Aethereum (0.005 a 0.2)
  // Se subimos moito de 0.2 empezamos a perder as vogais (soa a susurro)
  sNoiseThreshold.setTarget(0.005f + threshold * 0.195f);
}

void VocoderProcessor::setMix(float mix) {
  sMix.setTarget(std::clamp(mix, 0.0f, 1.0f));
}

void VocoderProcessor::setDiffusion(float diffusion) {
  // Controla o release do envelope: 0=definido, 1=difuso
  sDiffusion.setTarget(std::clamp(diffusion, 0.0f, 1.0f));
}

float VocoderProcessor::getModulatorRMS() {
  // Normalización para a UI (10x pre-gain)
  return std::clamp(mGlobalMod.getLevel() / 10.0f, 0.0f, 1.0f);
}
