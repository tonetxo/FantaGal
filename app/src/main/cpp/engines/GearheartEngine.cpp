#include "GearheartEngine.h"
#include <algorithm>
#include <android/log.h>
#include <cmath>
#include <cstring>

GearheartEngine::GearheartEngine()
    : rng_(std::random_device{}()), noiseDist_(-1.0f, 1.0f) {
  voices_.resize(MAX_VOICES);

  // Initialize default gear states (matching original TS implementation)
  // Gear(id, x, y, radius, teeth, angle, speed, isConnected, material)
  // Adjusted for mobile screen (approx 1080px width)
  gearStates_[0] = {0,      540.0f, 1000.0f, 0.02f, true, 0,
                    100.0f, 0,      14,      0.0f,  -1}; // Motor
  gearStates_[1] = {1, 540.0f, 750.0f, 0.0f, false, 1, 60.0f, 999, 8, 0.0f, -1};
  gearStates_[2] = {2,     340.0f, 1050.0f, 0.0f, false, 2,
                    50.0f, 999,    6,       0.0f, -1};
  gearStates_[3] = {3,     740.0f, 1050.0f, 0.0f, false, 3,
                    80.0f, 999,    10,      0.0f, -1};
  gearStates_[4] = {4, 540.0f, 500.0f, 0.0f, false, 4, 40.0f, 999, 5, 0.0f, -1};

  // Synchronize initial gears to the runtime map
  for (int i = 0; i < GEAR_COUNT; ++i) {
    gears_[i] = gearStates_[i];
  }
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
  pressure_ = state.pressure;
  resonance_ = state.resonance;
  viscosity_ = state.viscosity;
  turbulence_ = state.turbulence;
  diffusion_ = state.diffusion;

  // Master gain depends on pressure (0.35 - 0.75 range)
  // Reduced from 0.4-0.9 to provide headroom for multiple voices
  masterGain_ = 0.35f + pressure_ * 0.4f;
}

void GearheartEngine::updateGear(int32_t id, float speed, bool isConnected,
                                 int material, float radius, int depth) {
  if (id < 0 || id >= GEAR_COUNT)
    return;

  // Update both the map (for audio) and the array (for UI)
  AudioGear &gear = gears_[id];
  gear.id = id;
  gear.speed = speed;
  gear.isConnected = isConnected;
  gear.material = material;
  gear.radius = radius;
  gear.depth = depth;

  // Sync to gearStates_ for UI persistence
  gearStates_[id].speed = speed;
  gearStates_[id].isConnected = isConnected;
  gearStates_[id].depth = depth;
  // NOTE: angle is driven by the audio process loop for sample accuracy
}

void GearheartEngine::updateGearPosition(int32_t id, float x, float y) {
  if (id < 0 || id >= GEAR_COUNT)
    return;
  gearStates_[id].x = x;
  gearStates_[id].y = y;

  // Also update the map used by the audio thread
  if (gears_.count(id)) {
    gears_[id].x = x;
    gears_[id].y = y;
  }
}

void GearheartEngine::process(float *output, int32_t numFrames) {
  for (int32_t frame = 0; frame < numFrames; ++frame) {
    // 1. Update Gears & Triggers
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

        // Check full rotation (Trigger exactly at 12 o'clock / 0 radians)
        int currentRotation = static_cast<int>(std::floor(gear.angle / TWO_PI));
        if (currentRotation != gear.lastRotation) {
          triggerSound(gear);
          gear.lastRotation = currentRotation;
        }

        // Sync angle back to UI state array so Kotlin can read it
        gearStates_[gear.id].angle = gear.angle;
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
    // Feed = 0.5 + resonance scaling
    float feedback = 0.4f + resonance_ * 0.45f;
    reverbBuffer_[reverbWriteIndex_] = mix * 0.3f + reverbSample * feedback;
    reverbWriteIndex_ = (reverbWriteIndex_ + 1) % reverbBuffer_.size();

    // Reverb Mix - scaled conservatively to prevent clipping
    float finalMix = mix + reverbSample * (resonance_ * 0.45f);
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

  // Depth-based attenuation: further from motor = quieter
  // Gain = max(0.2, pow(0.85, depth))
  float attenuation =
      std::max(0.2f, std::pow(0.85f, static_cast<float>(gear.depth)));
  voice->gain = attenuation;

  // Determine Instrument by material first, then by ID
  // Material: 0=iron, 1=bronze, 2=copper, 3=gold, 4=platinum
  // Iron (motor, id=0) -> KICK
  // Platinum (id=4) -> HIHAT
  // Gold (id=3) -> SNARE
  // Bronze, Copper -> TOM (with different pitches)

  // LUBRICACIÓN (viscosity) affects decay: lower viscosity (closer to 0) =
  // shorter decay, higher viscosity (closer to 1) = longer decay (more
  // lubricated/smooth). VELOCIDADE (turbulence) adds randomized variability to
  // the decay.
  float baseDecayFactor = 0.2f + viscosity_ * 1.5f;
  float jitter = (generateNoise() * turbulence_ * 0.4f);
  float decayScale = std::max(0.1f, baseDecayFactor + jitter);

  // Determine Instrument by material first, then by ID
  if (gear.id == 0) {
    voice->type = InstrumentType::KICK;
    // Kicks need more minimum body: 0.5f floor for decayScale
    float kickDecayScale = std::max(0.5f, decayScale);
    voice->envDecay = 0.3f * kickDecayScale;
  } else if (gear.material == 4) { // Platinum
    voice->type = InstrumentType::HIHAT;
    voice->envDecay = 0.05f * decayScale;
  } else if (gear.material == 3) { // Gold
    voice->type = InstrumentType::SNARE;
    voice->envDecay = 0.15f * decayScale;
  } else {
    voice->type = InstrumentType::TOM;
    // Frequency based on radius: smaller = higher pitch
    float norm = 1.0f - ((gear.radius - 20.0f) / 100.0f);
    norm = std::clamp(norm, 0.0f, 1.0f);
    voice->frequency = 80.0f + norm * 200.0f; // 80-280 Hz range
    voice->envDecay = 0.2f * decayScale;
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
  // FAST Exponential Sweep for massive punch: 120Hz -> 38Hz
  // Drops 70% of frequency in first 30ms
  float sweepEnv = std::exp(-v.envTime * 35.0f);
  float freq = 38.0f + 82.0f * sweepEnv;

  v.phase += freq / sampleRate_;
  if (v.phase >= 1.0f)
    v.phase -= 1.0f;
  float sine = std::sin(v.phase * TWO_PI);

  // Click transient: harder drop 250Hz -> 60Hz
  float clickSweep = std::exp(-v.envTime * 80.0f);
  float clickFreq = 60.0f + 190.0f * clickSweep;
  v.phase2 += clickFreq / sampleRate_;
  if (v.phase2 >= 1.0f)
    v.phase2 -= 1.0f;
  float tri = 4.0f * std::abs(v.phase2 - 0.5f) - 1.0f;

  // Envelopes: Pure Exponential for tighter thump
  // Body (Sine)
  float subEnv = std::exp(-v.envTime * (4.0f / v.envDecay));

  // Click (Transient) - very fast
  float clickEnv = std::exp(-v.envTime * 150.0f);

  // Per-voice saturation to fatten the sound before voice gain
  // This prevents the "tom" sound by adding harmonic density
  float raw = (sine * subEnv * 2.8f + tri * clickEnv * 1.8f);
  float saturated = std::tanh(raw);

  return saturated * v.gain;
}

float GearheartEngine::synthesizeTom(GearVoice &v) {
  // Based on original TS playTomDrum
  // Sine sweep: freq -> freq*0.75 over 0.1s
  float sweep = std::min(1.0f, v.envTime / 0.1f);
  float freq = v.frequency * (1.0f - 0.25f * sweep);

  v.phase += freq / sampleRate_;
  if (v.phase >= 1.0f)
    v.phase -= 1.0f;
  float sine = std::sin(v.phase * TWO_PI);

  // Envelope with 3ms attack
  float env = 0.0f;
  if (v.envTime < 0.003f) {
    env = v.envTime / 0.003f;
  } else {
    env = std::exp(-(v.envTime - 0.003f) * (3.0f / v.envDecay));
  }

  // Volume based on frequency (lower = louder)
  float freqFactor = std::max(0.0f, 1.0f - (v.frequency / 500.0f));
  float baseVol = 1.0f + freqFactor * 1.5f;

  float out = sine * env * baseVol * v.gain;

  // Diffusion adds metallic texture to Toms
  if (diffusion_ > 0.1f) {
    float noiseAmount = diffusion_ * 0.3f * env;
    out += highpass(generateNoise() * noiseAmount, 1200.0f, v.noiseFilterState);
  }

  return out;
}

float GearheartEngine::synthesizeHiHat(GearVoice &v) {
  // Based on original TS playClosedHiHat
  // White noise through highpass at 10kHz
  float noise = generateNoise();
  float filtered = highpass(noise, 10000.0f, v.noiseFilterState);

  // Envelope: 3ms attack, fast decay (50ms total)
  float env = 0.0f;
  if (v.envTime < 0.003f) {
    env = v.envTime / 0.003f;
  } else {
    env = std::exp(-(v.envTime - 0.003f) * 60.0f);
  }

  return filtered * env * 1.0f * v.gain; // Increased from 0.3
}

float GearheartEngine::synthesizeSnare(GearVoice &v) {
  // Based on original TS playBrushSnare
  // Noise through bandpass at 2500Hz
  float noise = generateNoise();
  float filteredNoise = bandpass(noise, 2500.0f, 1.5f, v.noiseFilterState);

  // Body/tone oscillator: triangle 250Hz -> 220Hz
  float toneFreq = 220.0f + 30.0f * std::exp(-v.envTime * 20.0f);
  v.phase += toneFreq / sampleRate_;
  if (v.phase >= 1.0f)
    v.phase -= 1.0f;
  float tri = 4.0f * std::abs(v.phase - 0.5f) - 1.0f;

  // Noise envelope: 20ms attack, longer decay (150ms)
  float noiseEnv = 0.0f;
  if (v.envTime < 0.02f) {
    noiseEnv = v.envTime / 0.02f;
  } else {
    noiseEnv = std::exp(-(v.envTime - 0.02f) * 10.0f);
  }

  // Tone envelope: 3ms attack, fast decay (50ms)
  float toneEnv = 0.0f;
  if (v.envTime < 0.003f) {
    toneEnv = v.envTime / 0.003f;
  } else {
    toneEnv = std::exp(-(v.envTime - 0.003f) * 30.0f);
  }

  // Brush snare: noise dominant, soft tone - increased gains
  return (filteredNoise * noiseEnv * 0.6f + tri * toneEnv * 0.4f) * v.gain;
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
  // Use tanh for smoother saturation
  return std::tanh(x);
}

int32_t GearheartEngine::playNote(float frequency, float velocity) {
  return 0; // External triggers not used
}

void GearheartEngine::reset() {
  for (auto &v : voices_)
    v.active = false;
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
}
