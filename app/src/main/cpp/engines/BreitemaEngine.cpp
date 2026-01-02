#include "BreitemaEngine.h"
#include <algorithm>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static constexpr float TWO_PI = 2.0f * (float)M_PI;

BreitemaEngine::BreitemaEngine()
    : rng_(std::random_device{}()), dist_(0.0f, 1.0f) {
  voices_.resize(MAX_VOICES);
  for (int i = 0; i < NUM_STEPS; ++i) {
    steps_[i] = false;
    stepProbabilities_[i] = 0.5f;
  }
  generateRandomPattern();
}

void BreitemaEngine::prepare(int32_t sampleRate, int32_t framesPerBuffer) {
  sampleRate_ = sampleRate;
  framesPerBuffer_ = framesPerBuffer;

  reverbBuffer_.assign(sampleRate * 2, 0.0f);
  reverbWriteIndex_ = 0;

  reset();
}

void BreitemaEngine::process(float *output, int32_t numFrames) {
  std::lock_guard<std::mutex> lock(stateMutex_);

  float dt = 1.0f / sampleRate_;

  for (int32_t i = 0; i < numFrames; ++i) {
    if (isPlaying_) {
      // Check if it's time for the next step
      if (currentSampleCount_ >= nextStepTimeSamples_) {
        scheduleStep(currentStep_, currentSampleCount_);
        advanceStep();
      }
      currentSampleCount_ += 1.0;
    }

    // LFO for fog movement (0.1 - 2.0 Hz) - Increased range
    float lfoSpeed = 0.1f + fogMovement_ * 1.9f;
    fogLfoPhase_ += lfoSpeed * dt;
    if (fogLfoPhase_ >= 1.0f)
      fogLfoPhase_ -= 1.0f;

    // Mix voices
    float mix = 0.0f;
    for (auto &v : voices_) {
      if (v.active) {
        mix += synthesizeVoice(v);
        v.envTime += dt;
        if (v.envTime >= v.duration + 0.2f) { // Extra tail for safety
          v.active = false;
        }
      }
    }

    // Simple reverb
    int reverbDelay = static_cast<int>(sampleRate_ * 0.12f);
    int readIndex = (reverbWriteIndex_ - reverbDelay + reverbBuffer_.size()) %
                    reverbBuffer_.size();
    float reverbSample = reverbBuffer_[readIndex];

    float feedback = 0.5f + currentState_.resonance * 0.3f;
    reverbBuffer_[reverbWriteIndex_] = mix * 0.4f + reverbSample * feedback;
    reverbWriteIndex_ = (reverbWriteIndex_ + 1) % reverbBuffer_.size();

    float finalMix =
        mix * (1.1f - reverbMix_ * 0.5f) + reverbSample * reverbMix_;

    // Soft clip
    finalMix = std::tanh(finalMix * 0.8f);

    output[i * 2] = finalMix;
    output[i * 2 + 1] = finalMix;
  }
}

float BreitemaEngine::synthesizeVoice(FMVoice &v) {
  // Carrier Phase increment
  v.carrierPhase += v.frequency / sampleRate_;
  if (v.carrierPhase >= 1.0f)
    v.carrierPhase -= 1.0f;

  // Modulator Phase increment (2:1 ratio)
  v.modulatorPhase += (v.frequency * 2.0f) / sampleRate_;
  if (v.modulatorPhase >= 1.0f)
    v.modulatorPhase -= 1.0f;

  // FM synthesis
  float mod = std::sin(v.modulatorPhase * TWO_PI) * fmDepth_;
  float out = std::sin(v.carrierPhase * TWO_PI +
                       (mod / v.frequency)); // Basic phase mod

  // Envelope
  float ampEnv = 0.0f;
  float attack = 0.008f;
  if (v.envTime < attack) {
    ampEnv = v.envTime / attack;
  } else {
    ampEnv = std::exp(-(v.envTime - attack) * (1.0f / v.duration) * 4.0f);
  }

  return out * ampEnv * v.gain;
}

void BreitemaEngine::scheduleStep(int32_t step, double timeInSamples) {
  float baseProb = stepProbabilities_[step];

  // Fog modulation - increased impact
  float lfoMod = std::sin(fogLfoPhase_ * TWO_PI) * (0.1f + fogMovement_ * 0.3f);
  float prob =
      baseProb + (1.0f - baseProb) * (fogDensity_ - 0.2f) / 0.8f + lfoMod;
  prob = std::max(0.05f, std::min(1.0f, prob));

  if (steps_[step] && dist_(rng_) < prob) {
    float freq = SCALE_NOTES[step % 8];
    playFMNote(freq, timeInSamples);
  }
}

void BreitemaEngine::playFMNote(float freq, double timeInSamples) {
  // Find inactive voice
  for (auto &v : voices_) {
    if (!v.active) {
      v.active = true;
      v.frequency = freq;
      v.carrierPhase = 0.0f;
      v.modulatorPhase = 0.0f;
      v.envTime = 0.0f;
      v.duration = 60.0f / tempo_ / 2.0f;
      v.gain = 0.5f;
      break;
    }
  }
}

void BreitemaEngine::advanceStep() {
  int stepsPerBeat =
      (rhythmMode_ == 1) ? 3 : 4; // muineira is 6/8 -> 3 per beat
  samplesPerStep_ = (60.0 / tempo_) / (double)stepsPerBeat * sampleRate_;

  nextStepTimeSamples_ += samplesPerStep_;
  currentStep_ = (currentStep_ + 1) % NUM_STEPS;
}

void BreitemaEngine::updateParameters(const SynthState &state) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  currentState_ = state;

  // pressure -> tempo (60-180)
  tempo_ = 60.0f + state.pressure * 120.0f;

  // resonance -> FM depth (0-500)
  fmDepth_ = state.resonance * 500.0f;

  // viscosity -> fog density (0.2-1.0)
  fogDensity_ = 0.2f + state.viscosity * 0.8f;

  // turbulence -> fog movement
  fogMovement_ = state.turbulence * 2.0f;

  // diffusion -> reverb mix
  reverbMix_ = state.diffusion * 0.6f;
}

void BreitemaEngine::toggleStep(int32_t step) {
  if (step >= 0 && step < NUM_STEPS) {
    std::lock_guard<std::mutex> lock(stateMutex_);
    steps_[step] = !steps_[step];
  }
}

void BreitemaEngine::setRhythmMode(int32_t mode) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  rhythmMode_ = mode;
  // Called within lock, generateRandomPattern no longer locks internally
  generateRandomPattern();
}

void BreitemaEngine::generateRandomPattern() {
  // Simplified patterns based on original TS
  const float MUINEIRA[16] = {1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1};
  const float RIBEIRADA[16] = {1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1};

  // NOTE: This method is called from within locked contexts (setRhythmMode)
  // or during initialization.
  for (int i = 0; i < NUM_STEPS; ++i) {
    if (rhythmMode_ == 1) { // muineira
      // Use basis but allow for random omissions or additions
      float prob =
          MUINEIRA[i] > 0.5f ? 0.7f + dist_(rng_) * 0.3f : dist_(rng_) * 0.2f;
      stepProbabilities_[i] = prob;
      steps_[i] = prob > 0.4f;
    } else if (rhythmMode_ == 2) { // ribeirada
      float prob =
          RIBEIRADA[i] > 0.5f ? 0.7f + dist_(rng_) * 0.3f : dist_(rng_) * 0.2f;
      stepProbabilities_[i] = prob;
      steps_[i] = prob > 0.4f;
    } else {
      stepProbabilities_[i] = 0.3f + dist_(rng_) * 0.7f;
      steps_[i] = dist_(rng_) > 0.5f;
    }
  }
}

void BreitemaEngine::setPlaying(bool playing) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  if (playing && !isPlaying_) {
    currentStep_ = 0;
    currentSampleCount_ = 0;
    nextStepTimeSamples_ = 0;
  }
  isPlaying_ = playing;
}

BreitemaEngine::BreitemaState BreitemaEngine::getBreitemaState() const {
  std::lock_guard<std::mutex> lock(stateMutex_);
  BreitemaState s;
  std::copy(std::begin(steps_), std::end(steps_), std::begin(s.steps));
  s.currentStep = currentStep_;
  std::copy(std::begin(stepProbabilities_), std::end(stepProbabilities_),
            std::begin(s.stepProbabilities));
  s.fogDensity = fogDensity_;
  s.fogMovement = fogMovement_;
  s.fmDepth = fmDepth_;
  s.rhythmMode = rhythmMode_;
  s.isPlaying = isPlaying_;
  return s;
}

int32_t BreitemaEngine::playNote(float frequency, float velocity) { return 0; }
void BreitemaEngine::stopNote(int32_t noteId) {}
void BreitemaEngine::reset() {
  isPlaying_ = false;
  currentStep_ = 0;
  for (auto &v : voices_)
    v.active = false;
}
