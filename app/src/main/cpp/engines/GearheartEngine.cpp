#include "GearheartEngine.h"
#include <algorithm>
#include <cstring>

GearheartEngine::GearheartEngine()
    : rng_(std::random_device{}()), noiseDist_(-1.0f, 1.0f) {
  voices_.resize(MAX_VOICES);
}

void GearheartEngine::prepare(int32_t sampleRate, int32_t framesPerBuffer) {
  sampleRate_ = sampleRate;
  framesPerBuffer_ = framesPerBuffer;

  // Reverb buffer (2s)
  int reverbSize = sampleRate * 2;
  reverbBuffer_.resize(reverbSize, 0.0f);
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
  reverbWriteIndex_ = 0;
}

void GearheartEngine::updateParameters(const SynthState &state) {
  // Basic mapping
  // Viscosity -> speed (handled in UI mostly, but affects decay here?)
  // Turbulence -> variability in decay
  turbulence_ = state.turbulence;
  masterGain_ =
      0.3f + state.pressure * 0.2f; // Reduced gain to prevent distortion
}

void GearheartEngine::updateGear(int32_t id, float speed, bool isConnected,
                                 int material, float radius) {
  AudioGear &gear = gears_[id];
  gear.id = id;
  gear.speed = speed;
  gear.isConnected = isConnected;
  gear.material = material;
  gear.radius = radius;
  // Angle is preserved
}

void GearheartEngine::process(float *output, int32_t numFrames) {
  for (int32_t frame = 0; frame < numFrames; ++frame) {
    // 1. Update Gears & Triggers
    // We do this per-sample for precision, or per-block?
    // Per-sample is better for timing, but expensive.
    // Let's do per-sample to avoid jitter.

    float dt = 1.0f / sampleRate_;

    for (auto &pair : gears_) {
      AudioGear &gear = pair.second;
      if (gear.isConnected && std::abs(gear.speed) > 0.0001f) {
        // Speed is in radians per frame (from JS this was per frame 60fps)
        // Need to assume the passed speed is normalized or adjust it.
        // JS: speed = 0.02 rad/frame @ 60fps => 1.2 rad/s.
        // If UI sends "0.02" meaning 60fps speed, we need to scale.
        // Let's assume UI sends speed in radians/frame (60Hz reference)
        float speedPerSample = gear.speed * 60.0f * dt;

        gear.angle += speedPerSample;

        // Check full rotation
        int currentRotation = static_cast<int>(gear.angle / TWO_PI);
        if (currentRotation != gear.lastRotation) {
          if (gear.lastRotation != 0) { // Skip initialization trigger
            triggerSound(gear);
          }
          gear.lastRotation = currentRotation;
        }
      }
    }

    // 2. Synthesize Voices
    float mix = 0.0f;
    for (auto &voice : voices_) {
      if (voice.active) {
        mix += getNextSample(voice);
      }
    }

    // 3. Effects (Simple Reverb)
    int reverbDelay =
        static_cast<int>(sampleRate_ * 0.1f); // 100ms pre-delay/room
    int readIndex = (reverbWriteIndex_ - reverbDelay + reverbBuffer_.size()) %
                    reverbBuffer_.size();
    float reverbSample = reverbBuffer_[readIndex];

    // Simple dampening reverb
    reverbBuffer_[reverbWriteIndex_] = mix * 0.4f + reverbSample * 0.7f;
    reverbWriteIndex_ = (reverbWriteIndex_ + 1) % reverbBuffer_.size();

    float finalMix = mix + reverbSample * 0.3f;
    finalMix = softClip(finalMix * masterGain_);

    output[frame * 2] = finalMix;
    output[frame * 2 + 1] = finalMix;
  }
}

void GearheartEngine::triggerSound(const AudioGear &gear) {
  // Find free voice
  GearVoice *voice = nullptr;
  for (auto &v : voices_) {
    if (!v.active) {
      voice = &v;
      break;
    }
  }
  // If no free voice, steal oldest/quietest (simple: steal first)
  if (!voice)
    voice = &voices_[0];

  voice->active = true;
  voice->envTime = 0.0f;
  voice->envLevel = 0.0f; // Attack start
  voice->phase = 0.0f;
  voice->phase2 = 0.0f;
  voice->gain = 1.0f; // Use radius/depth to attenuate in future

  // Determine Instrument
  // 0=kick(motor), high radius
  // Material: 3=gold(snare), 4=platinum(hihat)

  if (gear.id == 0 || gear.radius >= 58.0f) {
    voice->type = InstrumentType::KICK;
    voice->envDecay = 0.4f + turbulence_ * 0.3f;
  } else if (gear.material == 4) { // Platinum
    voice->type = InstrumentType::HIHAT;
    voice->envDecay = 0.05f;
  } else if (gear.material == 3) { // Gold
    voice->type = InstrumentType::SNARE;
    voice->envDecay = 0.15f;
  } else {
    voice->type = InstrumentType::TOM;
    // Frequency mapping: A1(55) to A4(440) based on radius (60 to 20)
    // Normalized 0-1 (inverse radius)
    float norm = 1.0f - ((gear.radius - 20.0f) / 40.0f);
    norm = std::clamp(norm, 0.0f, 1.0f);
    // Approx mapping
    voice->frequency = 55.0f * std::pow(2.0f, norm * 3.0f); // 3 octaves
    voice->envDecay =
        (voice->frequency < 150.0f ? 0.4f : 0.25f) + turbulence_ * 0.2f;
  }
}

float GearheartEngine::getNextSample(GearVoice &v) {
  float dt = 1.0f / sampleRate_;
  v.envTime += dt;

  float sample = 0.0f;

  switch (v.type) {
  case InstrumentType::KICK:
    sample = synthesizeKick(v);
    break;
  case InstrumentType::TOM:
    sample = synthesizeTom(v);
    break;
  case InstrumentType::HIHAT:
    sample = synthesizeHiHat(v);
    break;
  case InstrumentType::SNARE:
    sample = synthesizeSnare(v);
    break;
  }

  if (v.envTime > v.envDecay) {
    v.active = false;
  }

  return sample;
}

float GearheartEngine::synthesizeKick(GearVoice &v) {
  // Sine sweep 55->30 Hz
  float sweep = 1.0f - std::min(1.0f, v.envTime / 0.15f);
  float freq = 30.0f + 25.0f * (sweep * sweep);

  v.phase += freq / sampleRate_;
  if (v.phase >= 1.0f)
    v.phase -= 1.0f;
  float sine = std::sin(v.phase * TWO_PI);

  // Click (Triangle 150->40)
  float clickFreq =
      40.0f + 110.0f * std::pow(std::max(0.0f, 1.0f - v.envTime / 0.03f), 2.0f);
  v.phase2 += clickFreq / sampleRate_;
  if (v.phase2 >= 1.0f)
    v.phase2 -= 1.0f;
  float tri = 4.0f * std::abs(v.phase2 - 0.5f) - 1.0f;

  // Envelopes
  float subEnv = 0.0f;
  if (v.envTime < 0.003f)
    subEnv = v.envTime / 0.003f; // Attack
  else
    subEnv = std::exp(-(v.envTime - 0.003f) * 10.0f); // Decay

  float clickEnv = 0.0f;
  if (v.envTime < 0.002f)
    clickEnv = v.envTime / 0.002f;
  else
    clickEnv = std::exp(-(v.envTime - 0.002f) * 50.0f);

  return (sine * subEnv * 4.0f + tri * clickEnv * 2.5f) * v.gain;
}

float GearheartEngine::synthesizeTom(GearVoice &v) {
  // Sine sweep
  float freq = v.frequency * (1.0f - 0.25f * std::min(1.0f, v.envTime / 0.1f));

  v.phase += freq / sampleRate_;
  if (v.phase >= 1.0f)
    v.phase -= 1.0f;
  float sine = std::sin(v.phase * TWO_PI);

  float env = 0.0f;
  if (v.envTime < 0.003f)
    env = v.envTime / 0.003f;
  else
    env = std::exp(-(v.envTime - 0.003f) * (5.0f / v.envDecay));

  return sine * env * v.gain;
}

float GearheartEngine::synthesizeHiHat(GearVoice &v) {
  float noise = generateNoise();
  // Highpass 10000Hz
  // Actually voice struct has noiseFilterState
  float filtered = highpass(noise, 10000.0f, v.noiseFilterState);

  float env = 0.0f;
  if (v.envTime < 0.003f)
    env = v.envTime / 0.003f;
  else
    env = std::exp(-(v.envTime - 0.003f) * 100.0f); // Fast decay

  return filtered * env * v.gain;
}

float GearheartEngine::synthesizeSnare(GearVoice &v) {
  // Noise BP 2500Hz
  float noise = generateNoise();
  float filteredNoise = bandpass(noise, 2500.0f, 1.5f, v.noiseFilterState);

  // Tone
  float toneFreq = 220.0f + 30.0f * std::exp(-v.envTime * 20.0f);
  v.phase += toneFreq / sampleRate_;
  if (v.phase >= 1.0f)
    v.phase -= 1.0f;
  float tri = 4.0f * std::abs(v.phase - 0.5f) - 1.0f;
  // Tone HP 200Hz (simplified)

  float noiseEnv = 0.0f;
  if (v.envTime < 0.003f)
    noiseEnv = v.envTime / 0.003f;
  else
    noiseEnv = std::exp(-(v.envTime - 0.003f) * 15.0f);

  return (filteredNoise * noiseEnv * 0.4f + tri * noiseEnv * 0.3f) * v.gain;
}

// Filters implementation
float GearheartEngine::lowpass(float input, float freq, float *state) {
  // One pole
  float dt = 1.0f / sampleRate_;
  float rc = 1.0f / (TWO_PI * freq);
  float alpha = dt / (rc + dt);
  state[0] += alpha * (input - state[0]);
  return state[0];
}

float GearheartEngine::highpass(float input, float freq, float *state) {
  // One pole
  float dt = 1.0f / sampleRate_;
  float rc = 1.0f / (TWO_PI * freq);
  float alpha = rc / (rc + dt);
  float output = alpha * (state[0] + input - state[1]);
  state[1] = input;
  state[0] = output;
  return output;
}

float GearheartEngine::bandpass(float input, float freq, float q,
                                float *state) {
  // SVF or Biquad? Using simplified 2-pole for now or just HP+LP
  // Let's use HP + LP for simplicity inside struct state size
  float hp = highpass(input, freq * 0.7f, &state[0]);
  // Note: state has only 2 floats. HP uses both [0] output [1] input prev
  // We need more state for BP if we do proper one.
  // Hack: Reuse global or just use simple approximation?
  // Let's use the Criosfera bandpass logic adjusted
  // Or just simple noise burst for snare
  return hp; // Placeholder, snare noise is noisy anyway
}

float GearheartEngine::generateNoise() { return noiseDist_(rng_); }

float GearheartEngine::softClip(float x) {
  if (x > 1.0f)
    return 1.0f - std::exp(-x + 1.0f);
  if (x < -1.0f)
    return -1.0f + std::exp(x + 1.0f);
  return x;
}

int32_t GearheartEngine::playNote(float frequency, float velocity) {
  return 0; // External triggers not used
}

void GearheartEngine::reset() {
  for (auto &v : voices_)
    v.active = false;
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
}
