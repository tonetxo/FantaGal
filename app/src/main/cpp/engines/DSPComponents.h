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

  float getLevel() const { return mEnvelope; }

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

/**
 * Línea de delay simple con buffer circular.
 * Soporta delay variable en tiempo de ejecución.
 */
class DelayLine {
public:
  DelayLine() = default;

  /**
   * Prepara el buffer con tamaño máximo en samples.
   * @param maxDelaySamples Máximo delay soportado
   */
  void prepare(size_t maxDelaySamples) {
    buffer_.resize(maxDelaySamples, 0.0f);
    maxDelay_ = maxDelaySamples;
    writeIndex_ = 0;
  }

  /**
   * Procesa una muestra con delay y feedback.
   * @param input Muestra de entrada
   * @param delaySamples Samples de delay (se clampa a máximo)
   * @param feedback Cantidad de feedback (0.0-1.0)
   * @return Muestra retardada
   */
  float process(float input, size_t delaySamples, float feedback = 0.0f) {
    if (buffer_.empty())
      return input;

    delaySamples = std::min(delaySamples, maxDelay_ - 1);

    size_t readIndex = (writeIndex_ + maxDelay_ - delaySamples) % maxDelay_;
    float delayed = buffer_[readIndex];

    buffer_[writeIndex_] = input + delayed * feedback;
    writeIndex_ = (writeIndex_ + 1) % maxDelay_;

    return delayed;
  }

  /**
   * Limpia el buffer.
   */
  void reset() {
    std::fill(buffer_.begin(), buffer_.end(), 0.0f);
    writeIndex_ = 0;
  }

private:
  std::vector<float> buffer_;
  size_t maxDelay_ = 0;
  size_t writeIndex_ = 0;
};

/**
 * Reverb simple basado en filtro comb con feedback.
 * Combina un delay con feedback + dry/wet mix.
 */
class SimpleReverb {
public:
  SimpleReverb() = default;

  /**
   * Prepara el reverb.
   * @param sampleRate Sample rate del sistema
   * @param maxTimeSeconds Tiempo máximo de reverb en segundos
   */
  void prepare(float sampleRate, float maxTimeSeconds = 2.0f) {
    sampleRate_ = sampleRate;
    size_t maxSamples = static_cast<size_t>(sampleRate * maxTimeSeconds);
    buffer_.resize(maxSamples, 0.0f);
    maxDelay_ = maxSamples;
    writeIndex_ = 0;
  }

  /**
   * Configura parámetros del reverb.
   * @param predelayMs Pre-delay en milisegundos
   * @param feedback Cantidad de feedback/decay (0.0-0.95 para estabilidad)
   * @param wetMix Mezcla wet (0.0-1.0)
   */
  void setParameters(float predelayMs, float feedback, float wetMix) {
    delaySamples_ = static_cast<size_t>(sampleRate_ * predelayMs * 0.001f);
    delaySamples_ = std::min(delaySamples_, maxDelay_ - 1);
    feedback_ = std::min(feedback, 0.95f); // Clamp para evitar runaway
    wetMix_ = std::clamp(wetMix, 0.0f, 1.0f);
  }

  /**
   * Procesa una muestra.
   * @param input Muestra de entrada (dry)
   * @return Muestra con reverb aplicado
   */
  float process(float input) {
    if (buffer_.empty())
      return input;

    size_t readIndex = (writeIndex_ + maxDelay_ - delaySamples_) % maxDelay_;
    float delayed = buffer_[readIndex];

    buffer_[writeIndex_] = input * inputGain_ + delayed * feedback_;
    writeIndex_ = (writeIndex_ + 1) % maxDelay_;

    // Dry/Wet mix
    return input * (1.0f - wetMix_) + delayed * wetMix_;
  }

  /**
   * Resetea el estado interno.
   */
  void reset() {
    std::fill(buffer_.begin(), buffer_.end(), 0.0f);
    writeIndex_ = 0;
  }

  /**
   * Obtiene solo la señal wet (para mezcla manual).
   */
  float getWetSample(float input) {
    if (buffer_.empty())
      return 0.0f;

    size_t readIndex = (writeIndex_ + maxDelay_ - delaySamples_) % maxDelay_;
    float delayed = buffer_[readIndex];

    buffer_[writeIndex_] = input * inputGain_ + delayed * feedback_;
    writeIndex_ = (writeIndex_ + 1) % maxDelay_;

    return delayed;
  }

private:
  std::vector<float> buffer_;
  float sampleRate_ = 48000.0f;
  size_t maxDelay_ = 0;
  size_t writeIndex_ = 0;
  size_t delaySamples_ = 4800; // 100ms default
  float feedback_ = 0.5f;
  float wetMix_ = 0.3f;
  float inputGain_ = 0.4f;
};
