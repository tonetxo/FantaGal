#pragma once

#include <array>
#include <cmath>
#include <vector>

/**
 * Oscilador con wavetable para diferentes formas de onda.
 */
class Oscillator {
public:
  enum class Waveform { Sawtooth = 0, Square, Triangle, Sine };

  Oscillator(float sampleRate) : mSampleRate(sampleRate) {
    generateWavetables();
  }

  void setFrequency(float freq) { mFrequency = freq; }
  void setWaveform(Waveform wave) { mWaveform = wave; }

  float process() {
    float sample = 0.0f;
    int index = static_cast<int>(mPhase * kTableSize) & (kTableSize - 1);

    switch (mWaveform) {
    case Waveform::Sawtooth:
      sample = mSawTable[index];
      break;
    case Waveform::Square:
      sample = mSquareTable[index];
      break;
    case Waveform::Triangle:
      sample = mTriTable[index];
      break;
    case Waveform::Sine:
      sample = mSineTable[index];
      break;
    }

    mPhase += mFrequency / mSampleRate;
    if (mPhase >= 1.0f)
      mPhase -= 1.0f;

    return sample;
  }

private:
  static constexpr int kTableSize = 2048;
  float mSampleRate;
  float mFrequency = 140.0f;
  float mPhase = 0.0f;
  Waveform mWaveform = Waveform::Sawtooth;

  std::array<float, kTableSize> mSawTable;
  std::array<float, kTableSize> mSquareTable;
  std::array<float, kTableSize> mTriTable;
  std::array<float, kTableSize> mSineTable;

  void generateWavetables() {
    for (int i = 0; i < kTableSize; i++) {
      float phase = static_cast<float>(i) / kTableSize;
      mSawTable[i] = 2.0f * phase - 1.0f;
      mSquareTable[i] = phase < 0.5f ? 1.0f : -1.0f;
      mTriTable[i] = 4.0f * std::abs(phase - 0.5f) - 1.0f;
      mSineTable[i] = std::sin(2.0f * M_PI * phase);
    }
  }
};

/**
 * Filtro biquad bandpass.
 */
class BandpassFilter {
public:
  void setCoefficients(float freq, float q, float sampleRate) {
    float w0 = 2.0f * M_PI * freq / sampleRate;
    float alpha = std::sin(w0) / (2.0f * q);
    float cosw0 = std::cos(w0);

    b0 = alpha;
    b1 = 0.0f;
    b2 = -alpha;
    a0 = 1.0f + alpha;
    a1 = -2.0f * cosw0;
    a2 = 1.0f - alpha;

    // Normalizar
    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    a1 /= a0;
    a2 /= a0;
  }

  float process(float input) {
    float output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = output;
    return output;
  }

private:
  float b0 = 0, b1 = 0, b2 = 0;
  float a0 = 1, a1 = 0, a2 = 0;
  float x1 = 0, x2 = 0, y1 = 0, y2 = 0;
};

/**
 * Filtro biquad highpass.
 */
class HighPassFilter {
public:
  void setCoefficients(float freq, float q, float sampleRate) {
    float w0 = 2.0f * M_PI * freq / sampleRate;
    float alpha = std::sin(w0) / (2.0f * q);
    float cosw0 = std::cos(w0);

    b0 = (1.0f + cosw0) / 2.0f;
    b1 = -(1.0f + cosw0);
    b2 = (1.0f + cosw0) / 2.0f;
    a0 = 1.0f + alpha;
    a1 = -2.0f * cosw0;
    a2 = 1.0f - alpha;

    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    a1 /= a0;
    a2 /= a0;
  }

  float process(float input) {
    float output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = output;
    return output;
  }

private:
  float b0 = 0, b1 = 0, b2 = 0;
  float a0 = 1, a1 = 0, a2 = 0;
  float x1 = 0, x2 = 0, y1 = 0, y2 = 0;
};

/**
 * Seguidor de envolvente con attack/release.
 */
class EnvelopeFollower {
public:
  EnvelopeFollower() = default;

  EnvelopeFollower(float sampleRate) { setSampleRate(sampleRate); }

  void setSampleRate(float sampleRate) {
    float attackMs = 2.0f;   // Más rápido para mejor definición de consonantes
    float releaseMs = 30.0f; // Más corto para evitar "cola" excesiva
    mAttack = std::exp(-1.0f / (sampleRate * attackMs * 0.001f));
    mRelease = std::exp(-1.0f / (sampleRate * releaseMs * 0.001f));
  }

  float process(float input) {
    float rectified = std::abs(input);
    if (rectified > mEnvelope) {
      mEnvelope = mAttack * mEnvelope + (1.0f - mAttack) * rectified;
    } else {
      mEnvelope = mRelease * mEnvelope + (1.0f - mRelease) * rectified;
    }
    return mEnvelope;
  }

private:
  float mAttack = 0.0f;
  float mRelease = 0.0f;
  float mEnvelope = 0.0f;
};

/**
 * Filtro de un polo para suavizar parámetros y evitar clics.
 */
class ParameterSmoother {
public:
  ParameterSmoother(float initialValue = 0.0f)
      : mCurrentValue(initialValue), mTargetValue(initialValue) {}

  void setTimeConstant(float timeConstantMs, float sampleRate) {
    mAlpha = std::exp(-1.0f / (sampleRate * timeConstantMs * 0.001f));
  }

  void setTarget(float target) { mTargetValue = target; }

  float process() {
    mCurrentValue = mAlpha * mCurrentValue + (1.0f - mAlpha) * mTargetValue;
    return mCurrentValue;
  }

  float getCurrentValue() const { return mCurrentValue; }

private:
  float mCurrentValue;
  float mTargetValue;
  float mAlpha = 0.99f;
};
