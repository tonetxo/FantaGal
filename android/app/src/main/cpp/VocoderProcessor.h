#pragma once

#include "DSPComponents.h"
#include <array>
#include <vector>

/**
 * Procesador de vocoder con 20 bandas.
 * Analiza la señal moduladora y aplica su envolvente al carrier.
 */
class VocoderProcessor {
public:
  static constexpr int kNumBands = 20;

  VocoderProcessor(float sampleRate);

  void process(const float *input, float *output, int numFrames);

  // Parámetros
  void setPitch(float pitch);
  void setIntensity(float intensity);
  void setWaveform(int type);
  void setVibrato(float amount);
  void setEcho(float amount);
  void setTremolo(float amount);
  void setNoiseThreshold(float threshold);

private:
  float mSampleRate;

  // Suavizadores de parámetros para evitar clics
  ParameterSmoother sIntensity;
  ParameterSmoother sNoiseThreshold;
  ParameterSmoother sEchoAmount;
  ParameterSmoother sVibratoAmount;
  ParameterSmoother sTremoloAmount;
  ParameterSmoother sBasePitch;

  // Oscilador carrier
  Oscillator mCarrier;

  // LFO para vibrato
  Oscillator mVibratoLFO;

  // LFO para tremolo
  Oscillator mTremoloLFO;

  // Filtro pasa-altos para el modulador (anti-rumble/acople)
  HighPassFilter mModHPF;

  // Bandas del vocoder
  struct Band {
    BandpassFilter modFilter;
    BandpassFilter carFilter;
    EnvelopeFollower envelope;
    float frequency;
  };
  std::array<Band, kNumBands> mBands;

  // Buffer de eco
  std::vector<float> mEchoBuffer;
  int mEchoIndex = 0;
  static constexpr int kEchoSamples = 14400; // 300ms @ 48kHz

  // Frecuencias de las bandas (mismas que Aethereum)
  static constexpr std::array<float, kNumBands> kBandFrequencies = {
      120,  180,  280,  380,  500,  650,  850,  1100,  1450,  1800,
      2200, 2700, 3400, 4200, 5200, 6500, 8000, 10000, 13000, 16000};

  void initBands();
};
