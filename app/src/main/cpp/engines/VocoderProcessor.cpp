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
  sDiffusion.setTimeConstant(20.0f, sampleRate);
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
    if (std::abs(resonance - lastRes_) > 0.1f) {
      const float freqs[16] = {150,  220,  320,  440,  620,  850,  1150, 1500,
                               2000, 2600, 3400, 4400, 5600, 6800, 8200, 10000};
      for (int i = 0; i < 16; i++) {
        mBands[i].modFilter.setCoefficients(freqs[i], resonance, mSampleRate);
        mBands[i].carFilter.setCoefficients(freqs[i], resonance, mSampleRate);
      }
      lastRes_ = resonance;
    }

    // Modulador: Preamplificación forte (x25), saturación suave e filtrado
    float modSample = modulator[frame] * 25.0f;
    modSample =
        fastTanh(modSample); // Saturación para mellor análise sen clipping duro
    modSample = mModHPF.process(modSample);

    // Carrier
    float carSample = carrier[frame];

    float mix = sMix.process();
    float diffusion = sDiffusion.process();

    // Actualizar release dos sobre se cambiou a difusión significativamente
    if (std::abs(diffusion - lastDiff_) > 0.05f) {
      // Mapeamos 0..1 a 20ms..500ms de release
      float releaseMs = 20.0f + diffusion * 480.0f;
      for (int i = 0; i < 16; i++) {
        mBands[i].envelope.setRelease(releaseMs);
      }
      lastDiff_ = diffusion;
    }

    float vocodeOutput = 0.0f;

    // Vocoding por bandas
    int bandIdx = 0;
    for (auto &band : mBands) {
      float modFiltered = band.modFilter.process(modSample);
      float env = band.envelope.process(modFiltered);

      // Boost progresivo en agudos para claridade (sibilancia) - FORTE
      float bandBoost =
          1.0f + (static_cast<float>(bandIdx) / 15.0f) * 3.0f; // Was 1.5f

      // Porta de ruído e aplicación do sobre ao carrier
      if (env > threshold) {
        float carFiltered = band.carFilter.process(carSample);
        // Use envelope directly (more responsive to transients)
        vocodeOutput += carFiltered * env * bandBoost;
      }
      bandIdx++;
    }

    // Mix final e ganancia master (compensación de bandas)
    vocodeOutput *=
        intensity * 4.0f; // Significant boost to match carrier levels

    // Suave limitación SOLO ao vocodeo procesado (antes de mix)
    // No clipping here - we want the vocoder to be as loud as the carrier

    // Blend con seco (Tormenta) - Crossfade real
    // mix=0: sólo carrier. mix=1: sólo vocoder
    float finalOut = (vocodeOutput * mix) + (carSample * (1.0f - mix));

    // Soft clip aí final
    if (finalOut > 1.0f)
      finalOut = 1.0f;
    if (finalOut < -1.0f)
      finalOut = -1.0f;

    output[frame] = finalOut;
  }
}

void VocoderProcessor::setIntensity(float intensity) {
  // Mapeo cuadrático: 0.5 a 8.0 (mellor control en baixos)
  float val = 0.5f + (intensity * intensity) * 7.5f;
  sIntensity.setTarget(val);
}

void VocoderProcessor::setResonance(float resonance) {
  // Mapeamos 0..1 a Q=3..30
  sResonance.setTarget(3.0f + resonance * 27.0f);
}

void VocoderProcessor::setNoiseThreshold(float threshold) {
  // Rango para evitar leaks: 0.005 a 0.15 (máis alto para reducir ruído)
  sNoiseThreshold.setTarget(0.005f + threshold * 0.145f);
}

void VocoderProcessor::setMix(float mix) {
  sMix.setTarget(std::clamp(mix, 0.0f, 1.0f));
}

void VocoderProcessor::setDiffusion(float diffusion) {
  sDiffusion.setTarget(std::clamp(diffusion, 0.0f, 1.0f));
}
