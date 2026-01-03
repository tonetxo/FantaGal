#pragma once

#include "DSPComponents.h"
#include <array>
#include <vector>

/**
 * VocoderProcessor - Vocoder de 20 bandas basado en Aethereum.
 * Usa un carrier externo (a mestura dos outros motores).
 */
class VocoderProcessor {
public:
  VocoderProcessor(float sampleRate);

  void process(const float *modulator, const float *carrier, float *output,
               int numFrames);

  // Setters para parámetros (adaptados á UI de FantaGal)
  void setIntensity(float intensity);      // Presión
  void setResonance(float resonance);      // Resonancia (Q do filtro)
  void setNoiseThreshold(float threshold); // Viscosidade (Gate)
  void setMix(float mix);                  // Tormenta (Wet/Dry)
  void setDiffusion(float diffusion);      // Difusión (for compatibility)

private:
  float mSampleRate;

  // 20 bandas de vocoding (mesmo que Aethereum)
  struct Band {
    BandpassFilter modFilter; // Analizador
    BandpassFilter carFilter; // Sintetizador
    EnvelopeFollower envelope;
    float frequency;
  };

  std::array<Band, 20> mBands;
  HighPassFilter mModHPF; // Para evitar realimentación e retumbos

  // Parameter smoothers
  ParameterSmoother sIntensity{1.5f};
  ParameterSmoother sResonance{18.0f};
  ParameterSmoother sNoiseThreshold{0.012f};
  ParameterSmoother sMix{0.5f};
  ParameterSmoother sDiffusion{0.5f};

  void setupBands();

  // Tracking for parameter change optimization
  float lastRes_ = -1.0f;
};
