#pragma once

#include "../BaseSynthEngine.h"
#include <cmath>
#include <map>
#include <random>
#include <vector>

/**
 * CriosferaEngine - Deep resonance physical modeling synthesizer
 *
 * Simulates giant organic pipes in cryogenic methane oceans.
 * Ported from TypeScript CriosferaEngine.ts
 *
 * Features:
 * - Dual detuned oscillators per voice
 * - Resonant lowpass filter
 * - LFO for turbulence modulation
 * - Simple reverb simulation
 * - ADSR envelope
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
  // Voice structure for polyphony
  struct Voice {
    int32_t id = -1;
    float frequency = 0.0f;
    float velocity = 0.0f;
    float phase1 = 0.0f; // Main oscillator phase
    float phase2 = 0.0f; // Detuned oscillator phase
    float envelopeLevel = 0.0f;
    float envelopeStage = 0; // 0=off, 1=attack, 2=decay, 3=sustain, 4=release
    bool active = false;
    bool releasing = false;
  };

  // Oscillator types
  enum class OscType { Sawtooth, Sine, Triangle };

  // DSP methods
  float generateOscillator(float phase, OscType type);
  float processFilter(float input, int channel);
  float processLFO();
  void processEnvelope(Voice &voice);
  float softClip(float x);

  // Constants
  static constexpr int MAX_VOICES = 8;
  static constexpr float TWO_PI = 6.283185307179586f;

  // Voices
  std::vector<Voice> voices_;
  int32_t nextNoteId_ = 0;

  // Filter state (stereo, 2-pole)
  float filterState_[2][2] = {{0.0f}}; // [channel][pole]
  float filterCutoff_ = 2000.0f;
  float filterResonance_ = 0.3f;

  // LFO
  float lfoPhase_ = 0.0f;
  float lfoFrequency_ = 0.5f;
  float lfoDepth_ = 0.0f;

  // Envelope parameters
  float attackTime_ = 0.1f;
  float decayTime_ = 0.3f;
  float sustainLevel_ = 0.7f;
  float releaseTime_ = 0.5f;

  // Detune and mix
  float detuneAmount_ = 0.005f; // 0.5% detune
  float masterGain_ = 0.7f;

  // Simple reverb (delay-based)
  static constexpr int REVERB_BUFFER_SIZE = 48000; // 1 second at 48kHz
  std::vector<float> reverbBuffer_;
  int reverbWriteIndex_ = 0;
  float reverbMix_ = 0.2f;
  float reverbDecay_ = 0.5f;

  // Random for noise
  std::mt19937 rng_;
  std::uniform_real_distribution<float> noiseDist_;
};
