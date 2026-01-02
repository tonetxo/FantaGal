#pragma once

#include "BaseSynthEngine.h"
#include <atomic>
#include <mutex>
#include <random>
#include <vector>

class BreitemaEngine : public BaseSynthEngine {
public:
  BreitemaEngine();
  ~BreitemaEngine() override = default;

  void prepare(int32_t sampleRate, int32_t framesPerBuffer) override;
  void process(float *output, int32_t numFrames) override;
  void updateParameters(const SynthState &state) override;
  int32_t playNote(float frequency, float velocity = 0.8f) override;
  void stopNote(int32_t noteId) override;
  void reset() override;

  // Brétema specific methods
  void toggleStep(int32_t step);
  void setRhythmMode(int32_t mode); // 0: libre, 1: muineira, 2: ribeirada
  void generateRandomPattern();

  // For UI sync
  struct BreitemaState {
    bool steps[16];
    int32_t currentStep;
    float stepProbabilities[16];
    float fogDensity;
    float fogMovement;
    float fmDepth;
    int32_t rhythmMode;
    bool isPlaying;
  };
  BreitemaState getBreitemaState() const;
  void setPlaying(bool playing);

private:
  struct FMVoice {
    bool active = false;
    float carrierPhase = 0.0f;
    float modulatorPhase = 0.0f;
    float frequency = 0.0f;
    float envTime = 0.0f;
    float duration = 0.0f;
    float gain = 0.0f;
  };

  void scheduleStep(int32_t step, double timeInSamples);
  void playFMNote(float freq, double timeInSamples);
  void advanceStep();
  float synthesizeVoice(FMVoice &v);

  static constexpr int32_t NUM_STEPS = 16;
  static constexpr int32_t MAX_VOICES = 8;

  // Sequencer state
  bool steps_[NUM_STEPS];
  float stepProbabilities_[NUM_STEPS];
  int32_t currentStep_ = 0;
  int32_t rhythmMode_ = 0;
  bool isPlaying_ = false;

  double nextStepTimeSamples_ = 0.0;
  double samplesPerStep_ = 0.0;
  double currentSampleCount_ = 0.0;

  float tempo_ = 120.0f;
  float fmDepth_ = 200.0f;
  float fogDensity_ = 0.5f;
  float fogMovement_ = 0.5f;
  float fogLfoPhase_ = 0.0f;
  float reverbMix_ = 0.3f;

  std::vector<FMVoice> voices_;
  mutable std::mutex stateMutex_;

  std::mt19937 rng_;
  std::uniform_real_distribution<float> dist_;

  const float SCALE_NOTES[8] = {110.00f, 123.47f, 130.81f, 146.83f,
                                164.81f, 174.61f, 196.00f, 220.00f};

  // Reverb simple
  std::vector<float> reverbBuffer_;
  size_t reverbWriteIndex_ = 0;
};
