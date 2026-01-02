#ifndef CRIOSFERA_ENGINE_H
#define CRIOSFERA_ENGINE_H

#include "../BaseSynthEngine.h"
#include <cmath>
#include <random>
#include <vector>

/**
 * CriosferaEngine - Ethereal atmospheric synthesizer
 *
 * Implements a heavily noise-based synthesis with:
 * - Filtered noise (primary sound source)
 * - Detuned oscillators (secondary, subtle)
 * - Long delay with feedback
 * - Large reverb
 * - LFO modulation on filter and delay
 */
class CriosferaEngine : public BaseSynthEngine {
public:
  CriosferaEngine();
  ~CriosferaEngine() override = default;

  void prepare(int32_t sampleRate, int32_t framesPerBuffer) override;
  void process(float *output, int32_t numFrames) override;
  void updateParameters(const SynthState &state) override;
  int32_t playNote(float frequency, float velocity) override;
  void stopNote(int32_t noteId) override;
  void reset() override;

private:
  static constexpr int MAX_VOICES = 8;
  static constexpr float TWO_PI = 6.28318530718f;
  static constexpr int MAX_DELAY_SAMPLES = 192000; // 4s at 48kHz

  // Voice with noise-based synthesis
  struct Voice {
    int32_t id = -1;
    float frequency = 0.0f;
    float velocity = 0.0f;
    bool active = false;
    bool releasing = false;

    // Oscillators
    float sawPhase = 0.0f;
    float triPhase = 0.0f;
    float sawDetune = 0.0f;
    float triDetune = 0.0f;

    // Noise filter state
    float noiseFilterState[2] = {0.0f, 0.0f};

    // Per-voice filter (sweeping)
    float filterFreq = 0.0f;
    float filterTarget = 0.0f;
    float filterState[2] = {0.0f, 0.0f};

    // Envelope
    float envelopeLevel = 0.0f;
    int envelopeStage = 0; // 0=off, 1=attack, 2=sustain, 3=release
    float releaseTime = 1.0f;
  };

  std::vector<Voice> voices_;
  int32_t nextNoteId_ = 1;

  // Global parameters
  float masterGain_ = 0.7f;
  float filterCutoff_ = 2000.0f;
  float filterQ_ = 1.0f;
  float delayTime_ = 0.5f;
  float delayFeedback_ = 0.4f;
  float lfoSpeed_ = 0.1f;
  float lfoFilterDepth_ = 500.0f;

  // LFO
  float lfoPhase_ = 0.0f;

  // Delay line
  std::vector<float> delayBuffer_;
  int delayWriteIndex_ = 0;

  // Reverb (simple allpass + comb)
  std::vector<float> reverbBuffer_;
  int reverbWriteIndex_ = 0;
  float reverbDecay_ = 0.85f;
  float reverbMix_ = 0.4f;

  // Global lowpass filter
  float globalFilterState_[2][2] = {{0.0f, 0.0f}, {0.0f, 0.0f}};

  // Noise generator
  std::mt19937 rng_;
  std::uniform_real_distribution<float> noiseDist_;

  // Helper functions
  float generateNoise();
  float sawtoothOsc(float phase);
  float triangleOsc(float phase);
  float getLfoValue(); // Sawtooth LFO like original
  float processVoice(Voice &voice);
  float resonantFilter(float input, float freq, float q, float *state);
  float bandpassFilter(float input, float freq, float q, float *state);
  float lowpassFilter(float input, float freq, float *state);
  void processEnvelope(Voice &voice);
  float softClip(float x);
};

#endif // CRIOSFERA_ENGINE_H
