#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

// Centralized audio constants
constexpr float TWO_PI = 6.28318530718f;

/**
 * Filtro biquad bandpass.
 */
class BandpassFilter {
public:
  void setCoefficients(float freq, float q, float sampleRate) {
    q = std::max(q, 0.01f);
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
    q = std::max(q, 0.01f);
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
    mSampleRate = sampleRate;
    setAttack(2.0f);
    setRelease(30.0f);
  }

  void setAttack(float attackMs) {
    mAttack = std::exp(-1.0f / (mSampleRate * attackMs * 0.001f));
  }

  void setRelease(float releaseMs) {
    mRelease = std::exp(-1.0f / (mSampleRate * releaseMs * 0.001f));
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
  float mSampleRate = 48000.0f;
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

/**
 * Aproximación rápida a tanh para soft clipping.
 */
inline float fastTanh(float x) {
  if (x < -3.0f)
    return -1.0f;
  if (x > 3.0f)
    return 1.0f;
  return x * (27.0f + x * x) / (27.0f + 9.0f * x * x);
}
