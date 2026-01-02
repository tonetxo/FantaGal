#include "VocoderProcessor.h"
#include <algorithm>

VocoderProcessor::VocoderProcessor(float sampleRate) : mSampleRate(sampleRate) {
  setupBands();

  // Configurar HPF para o modulador (corte en 150Hz)
  mModHPF.setCoefficients(150.0f, 0.707f, sampleRate);

  // Inicializar smoothers
  sIntensity.setTimeConstant(20.0f, sampleRate);
  sIntensity.setTarget(1.0f);
  sResonance = ParameterSmoother(12.0f); // Valor Q inicial seguro
  sResonance.setTimeConstant(30.0f, sampleRate);
  sNoiseThreshold.setTimeConstant(20.0f, sampleRate);
  sMix.setTimeConstant(20.0f, sampleRate);
}

void VocoderProcessor::setupBands() {
  // Frecuencias base para as 16 bandas (escala logarítmica de 150Hz a 8kHz)
  const float freqs[16] = {150,  220,  320,  440,  620,  850,  1150, 1500,
                           2000, 2600, 3400, 4400, 5600, 6800, 8200, 10000};

  for (int i = 0; i < 16; i++) {
    float q = 12.0f; // Q inicial
    mBands[i].modFilter.setCoefficients(freqs[i], q, mSampleRate);
    mBands[i].carFilter.setCoefficients(freqs[i], q, mSampleRate);
    mBands[i].envelope = EnvelopeFollower(mSampleRate);
  }
}

void VocoderProcessor::process(const float *modulator, const float *carrier,
                               float *output, int numFrames) {
  for (int frame = 0; frame < numFrames; frame++) {
    float intensity = sIntensity.process();
    float resonance = sResonance.process();
    float threshold = sNoiseThreshold.process();
    // Actualizar Q das bandas se cambiou a resonancia significativamente
    // (Poderíase optimizar para non facelo cada frame se o rendemento sofre)
    static float lastRes = -1.0f;
    if (std::abs(resonance - lastRes) > 0.1f) {
      const float freqs[16] = {150,  220,  320,  440,  620,  850,  1150, 1500,
                               2000, 2600, 3400, 4400, 5600, 6800, 8200, 10000};
      for (int i = 0; i < 16; i++) {
        mBands[i].modFilter.setCoefficients(freqs[i], resonance, mSampleRate);
        mBands[i].carFilter.setCoefficients(freqs[i], resonance, mSampleRate);
      }
      lastRes = resonance;
    }

    // Modulador: Preamplificación e filtrado
    float modSample = modulator[frame] * 12.0f;
    modSample = mModHPF.process(modSample);

    // Carrier
    float carSample = carrier[frame];

    float vocodeOutput = 0.0f;

    // Vocoding por bandas
    for (auto &band : mBands) {
      float modFiltered = band.modFilter.process(modSample);
      float env = band.envelope.process(modFiltered);

      // Porta de ruído e aplicación do sobre ao carrier
      if (env > threshold) {
        float carFiltered = band.carFilter.process(carSample);
        vocodeOutput += carFiltered * (env - threshold * 0.5f);
      }
    }

    // Mix final e ganancia master (compensación de bandas)
    vocodeOutput *= intensity * 0.8f;

    // Suave limitación (soft clip)
    if (vocodeOutput > 1.0f)
      vocodeOutput = 1.0f;
    if (vocodeOutput < -1.0f)
      vocodeOutput = -1.0f;

    output[frame] = vocodeOutput;
  }
}

void VocoderProcessor::setIntensity(float intensity) {
  sIntensity.setTarget(std::clamp(intensity * 4.0f, 0.1f, 6.0f));
}

void VocoderProcessor::setResonance(float resonance) {
  // Mapeamos 0..1 a Q=3..30
  sResonance.setTarget(3.0f + resonance * 27.0f);
}

void VocoderProcessor::setNoiseThreshold(float threshold) {
  sNoiseThreshold.setTarget(std::clamp(threshold * 0.2f, 0.005f, 0.2f));
}

void VocoderProcessor::setMix(float mix) {
  sMix.setTarget(std::clamp(mix, 0.0f, 1.0f));
}
