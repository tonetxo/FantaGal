#include "VocoderProcessor.h"
#include <algorithm>
#include <cmath>

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
}

void VocoderProcessor::setupBands() {
  // 20 bandas como en Aethereum (mismas frecuencias que referencia)
  const float freqs[20] = {120,  180,  280,  380,   500,   650,  850,
                           1100, 1450, 1800, 2200,  2700,  3400, 4200,
                           5200, 6500, 8000, 10000, 13000, 16000};

  // Q=18 como en referencia
  constexpr float Q = 18.0f;

  for (int i = 0; i < 20; i++) {
    mBands[i].frequency = freqs[i];
    mBands[i].modFilter.setCoefficients(freqs[i], Q, mSampleRate);
    mBands[i].carFilter.setCoefficients(freqs[i], Q, mSampleRate);
    mBands[i].envelope = EnvelopeFollower(mSampleRate);
    // EnvelopeFollower ya usa 2ms attack, 30ms release por defecto - perfecto
  }
}

void VocoderProcessor::process(const float *modulator, const float *carrier,
                               float *output, int numFrames) {
  // Frecuencias para actualización de filtros
  const float freqs[20] = {120,  180,  280,  380,   500,   650,  850,
                           1100, 1450, 1800, 2200,  2700,  3400, 4200,
                           5200, 6500, 8000, 10000, 13000, 16000};

  for (int frame = 0; frame < numFrames; frame++) {
    float intensity = sIntensity.process();
    float resonance = sResonance.process();
    float threshold = sNoiseThreshold.process();

    // Actualizar Q das bandas se cambiou a resonancia significativamente
    if (std::abs(resonance - lastRes_) > 0.5f) {
      for (int i = 0; i < 20; i++) {
        mBands[i].modFilter.setCoefficients(freqs[i], resonance, mSampleRate);
        mBands[i].carFilter.setCoefficients(freqs[i], resonance, mSampleRate);
      }
      lastRes_ = resonance;
    }

    // Actualizar release do envelope se cambiou a difusión
    float diffusion = sDiffusion.process();
    if (std::abs(diffusion - lastDiff_) > 0.02f) {
      // 0 = 15ms (moi definido), 1 = 150ms (moi difuso)
      float releaseMs = 15.0f + diffusion * 135.0f;
      for (int i = 0; i < 20; i++) {
        mBands[i].envelope.setRelease(releaseMs);
      }
      lastDiff_ = diffusion;
    }

    // Modulador: Preamplificación x16 como referencia
    float modSample = modulator[frame] * 16.0f;
    modSample = mModHPF.process(modSample);

    // Carrier (de otros motores)
    float carSample = carrier[frame];

    float mix = sMix.process();

    float vocodeOutput = 0.0f;

    // Vocoding: proceso igual que referencia
    for (auto &band : mBands) {
      float filteredMod = band.modFilter.process(modSample);
      float envelope = band.envelope.process(filteredMod);

      // Porta de ruído igual que referencia: boost = (envelope - threshold *
      // 0.5)
      if (envelope > threshold) {
        float filteredCar = band.carFilter.process(carSample);
        float boost = (envelope - threshold * 0.5f);
        vocodeOutput += filteredCar * boost * intensity;
      }
    }

    // Normalización base como referencia
    vocodeOutput *= 0.7f;

    // Blend con seco (Tormenta / Mix)
    // mix=0: sólo carrier. mix=1: sólo vocoder
    float finalOut = (vocodeOutput * mix) + (carSample * (1.0f - mix));

    // Soft clip como referencia
    if (finalOut > 1.0f)
      finalOut = 1.0f;
    if (finalOut < -1.0f)
      finalOut = -1.0f;

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
  // Rango como referencia: 0.005 a 0.2
  sNoiseThreshold.setTarget(0.005f + threshold * 0.195f);
}

void VocoderProcessor::setMix(float mix) {
  sMix.setTarget(std::clamp(mix, 0.0f, 1.0f));
}

void VocoderProcessor::setDiffusion(float diffusion) {
  // Controla o release do envelope: 0=definido, 1=difuso
  sDiffusion.setTarget(std::clamp(diffusion, 0.0f, 1.0f));
}
