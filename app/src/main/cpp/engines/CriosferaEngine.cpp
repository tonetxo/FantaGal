#include "CriosferaEngine.h"
#include <algorithm>
#include <cstring>

CriosferaEngine::CriosferaEngine()
    : rng_(std::random_device{}()), noiseDist_(-1.0f, 1.0f) {
  voices_.resize(MAX_VOICES);
}

void CriosferaEngine::prepare(int32_t sampleRate, int32_t framesPerBuffer) {
  sampleRate_ = sampleRate;
  framesPerBuffer_ = framesPerBuffer;

  // Setup delay buffer (max 4 seconds)
  delayBuffer_.resize(MAX_DELAY_SAMPLES, 0.0f);
  std::fill(delayBuffer_.begin(), delayBuffer_.end(), 0.0f);
  delayWriteIndex_ = 0;

  // Setup reverb buffer
  int reverbSize = sampleRate * 2;
  reverbBuffer_.resize(reverbSize, 0.0f);
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
  reverbWriteIndex_ = 0;

  memset(globalFilterState_, 0, sizeof(globalFilterState_));
  lfoPhase_ = 0.0f;
}

float CriosferaEngine::generateNoise() { return noiseDist_(rng_); }

float CriosferaEngine::sawtoothOsc(float phase) { return 2.0f * phase - 1.0f; }

float CriosferaEngine::triangleOsc(float phase) {
  return 4.0f * std::abs(phase - 0.5f) - 1.0f;
}

float CriosferaEngine::getLfoValue() {
  float value = 2.0f * lfoPhase_ - 1.0f;
  lfoPhase_ += lfoSpeed_ / static_cast<float>(sampleRate_);
  if (lfoPhase_ >= 1.0f)
    lfoPhase_ -= 1.0f;
  return value;
}

// Simple one-pole lowpass filter
float CriosferaEngine::lowpassFilter(float input, float freq, float *state) {
  if (sampleRate_ <= 0)
    return input;

  float rc = 1.0f / (2.0f * 3.14159f * freq);
  float dt = 1.0f / static_cast<float>(sampleRate_);
  float alpha = dt / (rc + dt);
  alpha = std::clamp(alpha, 0.0f, 1.0f);

  state[0] = state[0] + alpha * (input - state[0]);
  return state[0];
}

// Resonant State Variable Filter (Chamberlin)
float CriosferaEngine::resonantFilter(float input, float freq, float q,
                                      float *state) {
  if (sampleRate_ <= 0)
    return input;

  // Ensure stable range
  float f = 2.0f * std::sin(3.14159f * freq / static_cast<float>(sampleRate_));
  f = std::clamp(f, 0.0f, 1.4f); // Stability limit
  float damping = 1.0f / std::max(0.1f, q);

  // SVF Algorithm: state[0]=low, state[1]=band
  float low = state[0] + f * state[1];
  float high = input - low - damping * state[1];
  float band = f * high + state[1];

  state[0] = low;
  state[1] = band;

  return low;
}

// Simple bandpass using two one-pole filters
float CriosferaEngine::bandpassFilter(float input, float freq, float q,
                                      float *state) {
  if (sampleRate_ <= 0)
    return input;

  // Highpass then lowpass for simple bandpass
  float hp = input - lowpassFilter(input, freq * 0.5f, &state[0]);
  float bp = lowpassFilter(hp, freq * 2.0f, &state[1]);
  return bp * 2.0f; // Boost
}

float CriosferaEngine::processVoice(Voice &voice) {
  if (!voice.active)
    return 0.0f;

  // Generate noise (main source for ethereal sound)
  float noise = generateNoise();

  // Simple filtering of noise around the note frequency
  float filteredNoise =
      lowpassFilter(noise, voice.frequency * 3.0f, voice.noiseFilterState);

  // Generate oscillators (subtle, detuned)
  float sawFreq = voice.frequency * (1.0f + voice.sawDetune);
  float triFreq = voice.frequency * (1.0f + voice.triDetune);

  float saw = sawtoothOsc(voice.sawPhase);
  float tri = triangleOsc(voice.triPhase);

  // Advance phases
  voice.sawPhase += sawFreq / static_cast<float>(sampleRate_);
  if (voice.sawPhase >= 1.0f)
    voice.sawPhase -= 1.0f;

  voice.triPhase += triFreq / static_cast<float>(sampleRate_);
  if (voice.triPhase >= 1.0f)
    voice.triPhase -= 1.0f;

  // Mix: noise 60% + oscillators 40% (more tonal, better modulation response)
  float mix = filteredNoise * 0.6f + saw * 0.2f + tri * 0.2f;

  // Apply per-voice filter with faster sweep (1.5s like original)
  // Speed: 0.0001f = very slow, 0.001f = faster
  voice.filterFreq += (voice.filterTarget - voice.filterFreq) * 0.0005f;
  float filtered = lowpassFilter(mix, voice.filterFreq, voice.filterState);

  // Apply envelope
  return filtered * voice.envelopeLevel * voice.velocity;
}

void CriosferaEngine::processEnvelope(Voice &voice) {
  float sampleTime = 1.0f / static_cast<float>(sampleRate_);

  switch (voice.envelopeStage) {
  case 1: // Attack
    voice.envelopeLevel += sampleTime / 0.05f;
    if (voice.envelopeLevel >= 1.0f) {
      voice.envelopeLevel = 1.0f;
      voice.envelopeStage = 2;
    }
    break;
  case 2: // Sustain
    break;
  case 3: // Release
    voice.envelopeLevel -= sampleTime / voice.releaseTime;
    if (voice.envelopeLevel <= 0.0f) {
      voice.envelopeLevel = 0.0f;
      voice.envelopeStage = 0;
      voice.active = false;
    }
    break;
  default:
    break;
  }
}

void CriosferaEngine::process(float *output, int32_t numFrames) {
  for (int32_t frame = 0; frame < numFrames; ++frame) {
    float lfo = getLfoValue();

    // Mix all voices
    float voiceMix = 0.0f;
    for (auto &voice : voices_) {
      if (!voice.active)
        continue;
      processEnvelope(voice);
      voiceMix += processVoice(voice);
    }

    // Apply global lowpass filter with LFO modulation (smoothed to avoid
    // clicks)
    float targetCutoff = filterCutoff_ + lfo * lfoFilterDepth_;
    targetCutoff = std::clamp(targetCutoff, 100.0f, 15000.0f);

    // Smooth the cutoff changes to avoid clicks when dragging
    smoothedCutoff_ += (targetCutoff - smoothedCutoff_) * 0.01f;

    float filtered = resonantFilter(voiceMix, smoothedCutoff_, filterQ_,
                                    globalFilterState_[0]);

    // Simple delay
    int delaySamples = static_cast<int>(delayTime_ * sampleRate_);
    delaySamples = std::clamp(delaySamples, 1, MAX_DELAY_SAMPLES - 1);

    int readIndex = (delayWriteIndex_ - delaySamples + MAX_DELAY_SAMPLES) %
                    MAX_DELAY_SAMPLES;
    float delayedSample = delayBuffer_[readIndex];

    // Simple delay with reduced feedback to input
    delayBuffer_[delayWriteIndex_] =
        filtered * 0.5f + delayedSample * delayFeedback_ * 0.5f;
    delayWriteIndex_ = (delayWriteIndex_ + 1) % MAX_DELAY_SAMPLES;

    // Simple reverb with reduced input
    int reverbDelay = static_cast<int>(sampleRate_ * 0.08f);
    int reverbReadIndex =
        (reverbWriteIndex_ - reverbDelay + reverbBuffer_.size()) %
        reverbBuffer_.size();
    float reverbSample = reverbBuffer_[reverbReadIndex];

    reverbBuffer_[reverbWriteIndex_] =
        filtered * 0.3f + reverbSample * reverbDecay_;
    reverbWriteIndex_ = (reverbWriteIndex_ + 1) % reverbBuffer_.size();

    // Mix dry + delay + reverb (balanced to avoid saturation)
    float wetMix =
        filtered * 0.6f + delayedSample * 0.2f + reverbSample * reverbMix_;

    // Apply master gain and soft clip
    float finalSample = softClip(wetMix * masterGain_);

    // Output stereo
    output[frame * 2] = finalSample;
    output[frame * 2 + 1] = finalSample;
  }
}

float CriosferaEngine::softClip(float x) {
  if (x > 1.0f)
    return 1.0f - std::exp(-x + 1.0f);
  if (x < -1.0f)
    return -1.0f + std::exp(x + 1.0f);
  return x;
}

void CriosferaEngine::updateParameters(const SynthState &state) {
  currentState_ = state;

  // Pressure = master gain (more dynamic range)
  masterGain_ = 0.3f + state.pressure * 0.7f;

  // Viscosity = filter cutoff (inverted, more dramatic range)
  filterCutoff_ = 12000.0f - state.viscosity * 11500.0f;
  filterCutoff_ = std::clamp(filterCutoff_, 150.0f, 12000.0f);

  // Resonance = filter Q + delay feedback (Reduced intensity)
  filterQ_ = 1.0f + state.resonance * 10.0f;       // Max Q=11 (was 21)
  delayFeedback_ = 0.15f + state.resonance * 0.7f; // Max 0.85 (was 0.95)

  // Turbulence = LFO speed and depth (MORE AGGRESSIVE)
  lfoSpeed_ = 0.1f + state.turbulence * 12.0f; // Max 12.1 Hz (was 8)
  lfoFilterDepth_ =
      100.0f + state.turbulence * 3000.0f; // Max 3100 Hz (was 1550)

  // Diffusion = delay time and reverb (MORE AGGRESSIVE)
  delayTime_ = 0.1f + state.diffusion * 2.5f;    // Max 2.6s delay (was 2.1)
  reverbMix_ = 0.25f + state.diffusion * 0.65f;  // Max 0.9 mix (was 0.7)
  reverbDecay_ = 0.65f + state.diffusion * 0.3f; // Max 0.95 decay (was 0.9)

  float releaseTime = 1.0f + state.viscosity * 2.0f;
  for (auto &voice : voices_) {
    voice.releaseTime = releaseTime;
  }
}

int32_t CriosferaEngine::playNote(float frequency, float velocity) {
  Voice *freeVoice = nullptr;

  for (auto &voice : voices_) {
    if (!voice.active) {
      freeVoice = &voice;
      break;
    }
  }

  if (!freeVoice) {
    for (auto &voice : voices_) {
      if (voice.releasing) {
        freeVoice = &voice;
        break;
      }
    }
  }

  if (!freeVoice) {
    freeVoice = &voices_[0];
  }

  int32_t noteId = nextNoteId_++;
  freeVoice->id = noteId;
  freeVoice->frequency = frequency;
  freeVoice->velocity = velocity;
  freeVoice->active = true;
  freeVoice->releasing = false;

  freeVoice->sawDetune = (generateNoise() * 0.5f) * 0.01f;
  freeVoice->triDetune = (generateNoise() * 0.5f - 0.3f) * 0.02f;

  freeVoice->sawPhase = 0.0f;
  freeVoice->triPhase = 0.0f;

  memset(freeVoice->noiseFilterState, 0, sizeof(freeVoice->noiseFilterState));
  memset(freeVoice->filterState, 0, sizeof(freeVoice->filterState));

  freeVoice->filterFreq = frequency * 1.0f;
  freeVoice->filterTarget = frequency * 4.0f;

  freeVoice->envelopeLevel = 0.0f;
  freeVoice->envelopeStage = 1;

  freeVoice->releaseTime = 1.0f + (currentState_.viscosity * 2.0f);

  return noteId;
}

void CriosferaEngine::stopNote(int32_t noteId) {
  for (auto &voice : voices_) {
    if (voice.id == noteId && voice.active) {
      voice.releasing = true;
      voice.envelopeStage = 3;
      break;
    }
  }
}

void CriosferaEngine::reset() {
  for (auto &voice : voices_) {
    voice.active = false;
    voice.envelopeLevel = 0.0f;
    voice.envelopeStage = 0;
  }

  std::fill(delayBuffer_.begin(), delayBuffer_.end(), 0.0f);
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
  memset(globalFilterState_, 0, sizeof(globalFilterState_));
  lfoPhase_ = 0.0f;
}
