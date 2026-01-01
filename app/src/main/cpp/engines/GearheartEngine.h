#ifndef GEARHEART_ENGINE_H
#define GEARHEART_ENGINE_H

#include "../BaseSynthEngine.h"
#include <cmath>
#include <map>
#include <random>
#include <vector>

enum class InstrumentType { KICK, TOM, HIHAT, SNARE };

struct GearVoice {
  bool active = false;
  InstrumentType type = InstrumentType::TOM;

  float frequency = 0.0f; // Base freq
  float startFreq = 0.0f;
  float endFreq = 0.0f;

  // Oscillators
  float phase = 0.0f;
  float phase2 = 0.0f; // For secondary components (click, body)

  // Envelopes
  float envLevel = 0.0f;
  float envDecay = 0.0f;
  float envTime = 0.0f;

  // Noise
  float noiseFilterState[2] = {0.0f, 0.0f};

  // Volume/Velocity
  float gain = 1.0f;
};

struct AudioGear {
  int32_t id;
  float speed = 0.0f;
  bool isConnected = false;
  int material = 0; // 0=iron, 1=bronze, 2=copper, 3=gold, 4=platinum
  float radius = 40.0f;

  // Runtime
  float angle = 0.0f;
  int lastRotation = 0;
};

class GearheartEngine : public BaseSynthEngine {
public:
  GearheartEngine();
  ~GearheartEngine() override = default;

  void prepare(int32_t sampleRate, int32_t framesPerBuffer) override;
  void process(float *output, int32_t numFrames) override;
  void updateParameters(const SynthState &state) override;

  // Not used for keyboard, but for internal triggers
  int32_t playNote(float frequency, float velocity) override;
  void stopNote(int32_t noteId) override {}
  void reset() override;

  // Custom method to update gear state from UI
  void updateGear(int32_t id, float speed, bool isConnected, int material,
                  float radius);

private:
  static constexpr int MAX_VOICES = 16;
  static constexpr float TWO_PI = 6.28318530718f;

  std::vector<GearVoice> voices_;
  std::map<int32_t, AudioGear> gears_;

  // Parameters
  float masterGain_ = 1.0f;
  float turbulence_ = 0.0f; // Affects decay variability

  // Reverb
  std::vector<float> reverbBuffer_;
  int reverbWriteIndex_ = 0;

  // Generators
  std::mt19937 rng_;
  std::uniform_real_distribution<float> noiseDist_;

  // Helpers
  float generateNoise();
  float getNextSample(GearVoice &voice);
  void triggerSound(const AudioGear &gear);

  // Instrument synthesis
  float synthesizeKick(GearVoice &v);
  float synthesizeTom(GearVoice &v);
  float synthesizeHiHat(GearVoice &v);
  float synthesizeSnare(GearVoice &v);

  // Filters
  float lowpass(float input, float freq, float *state);
  float highpass(float input, float freq, float *state);
  float bandpass(float input, float freq, float q, float *state);

  float softClip(float x);
};

#endif // GEARHEART_ENGINE_H
