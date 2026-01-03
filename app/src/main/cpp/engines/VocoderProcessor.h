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
  static constexpr int kNumBands = 20;

  VocoderProcessor(float sampleRate);

  void process(const float *modulator, const float *carrier, float *output,
               int numFrames);

  // Setters para parámetros (adaptados á UI de FantaGal)
  void setIntensity(float intensity);      // Presión
  void setResonance(float resonance);      // Resonancia (Q do filtro)
  void setNoiseThreshold(float threshold); // Viscosidade (Gate)
  void setMix(float mix);                  // Tormenta (Wet/Dry)
  void setDiffusion(float diffusion);      // Difusión (for compatibility)
  float getModulatorRMS();                 // Nivel RMS do modulador

private:
  float mSampleRate;

  // 20 bandas de vocoding (mesmo que Aethereum)
  struct Band {
    BandpassFilter modFilter; // Analizador
    BandpassFilter carFilter; // Sintetizador
    EnvelopeFollower envelope;
    float frequency;
  };

  std::array<Band, kNumBands> mBands;
  HighPassFilter mModHPF;      // Para evitar realimentación e retumbos
  EnvelopeFollower mGlobalMod; // Seguidor global para porta de ruído maestra

  // Parameter smoothers con mejoras
  ParameterSmoother sIntensity{1.5f};
  ParameterSmoother sResonance{18.0f};
  ParameterSmoother sNoiseThreshold{0.012f};
  ParameterSmoother sMix{0.5f};
  ParameterSmoother sDiffusion{0.5f};

  void setupBands();

  // Tracking for parameter change optimization
  float lastRes_ = -1.0f;
  float lastDiff_ = -1.0f;

  // Frecuencias de las bandas (mismas que Aethereum)
  static constexpr std::array<float, kNumBands> kBandFrequencies = {
      120,  180,  280,  380,  500,  650,  850,  1100,  1450,  1800,
      2200, 2700, 3400, 4200, 5200, 6500, 8000, 10000, 13000, 16000};
};
