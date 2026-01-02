#pragma once

#include "DSPComponents.h"
#include <array>
#include <vector>

/**
 * VocoderProcessor - Recrea o motor de vocoding de 16 bandas de Aethereum.
 * Adaptado para usar un carrier externo (a mestura dos outros motores).
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
  void setDiffusion(float diffusion);      // Difusión (Release)

private:
  float mSampleRate;

  // 16 bandas de vocoding
  struct Band {
    BandpassFilter modFilter; // Analizador
    BandpassFilter carFilter; // Sintetizador
    EnvelopeFollower envelope;
  };

  std::array<Band, 16> mBands;
  HighPassFilter mModHPF; // Para evitar realimentación e retumbos

  // Parameter smoothers
  ParameterSmoother sIntensity{1.0f};
  ParameterSmoother sResonance{5.0f};
  ParameterSmoother sNoiseThreshold{0.01f};
  ParameterSmoother sMix{0.5f};
  ParameterSmoother sDiffusion{1.0f};

  void setupBands();

  // Tracking for parameter change optimization (moved from static in process())
  float lastRes_ = -1.0f;
  float lastDiff_ = -1.0f;
};
