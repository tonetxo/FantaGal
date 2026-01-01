#include "CriosferaEngine.h"
#include <algorithm>
#include <cstring>

CriosferaEngine::CriosferaEngine()
    : rng_(std::random_device{}()), noiseDist_(-1.0f, 1.0f) {
  voices_.resize(MAX_VOICES);
  reverbBuffer_.resize(REVERB_BUFFER_SIZE, 0.0f);
}

void CriosferaEngine::prepare(int32_t sampleRate, int32_t framesPerBuffer) {
  sampleRate_ = sampleRate;
  framesPerBuffer_ = framesPerBuffer;

  // Resize reverb buffer based on sample rate
  reverbBuffer_.resize(sampleRate, 0.0f);
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
  reverbWriteIndex_ = 0;

  // Reset filter state
  memset(filterState_, 0, sizeof(filterState_));

  // Reset LFO
  lfoPhase_ = 0.0f;
}

void CriosferaEngine::process(float *output, int32_t numFrames) {
  // Process each frame
  for (int32_t frame = 0; frame < numFrames; ++frame) {
    float leftSample = 0.0f;
    float rightSample = 0.0f;

    // Get LFO value for this frame
    float lfoValue = processLFO();

    // Process all active voices
    for (auto &voice : voices_) {
      if (!voice.active)
        continue;

      // Process envelope
      processEnvelope(voice);

      if (voice.envelopeLevel <= 0.0001f && voice.releasing) {
        voice.active = false;
        continue;
      }

      // Calculate phase increments
      float phaseInc1 = voice.frequency / static_cast<float>(sampleRate_);
      float phaseInc2 = (voice.frequency * (1.0f + detuneAmount_)) /
                        static_cast<float>(sampleRate_);

      // Apply LFO modulation to frequency
      float lfoMod = 1.0f + (lfoValue * lfoDepth_ * 0.02f);
      phaseInc1 *= lfoMod;
      phaseInc2 *= lfoMod;

      // Generate oscillators (sawtooth)
      float osc1 = generateOscillator(voice.phase1, OscType::Sawtooth);
      float osc2 = generateOscillator(voice.phase2, OscType::Sawtooth);

      // Mix oscillators
      float voiceSample =
          (osc1 * 0.6f + osc2 * 0.4f) * voice.velocity * voice.envelopeLevel;

      // Advance phases
      voice.phase1 += phaseInc1;
      voice.phase2 += phaseInc2;
      if (voice.phase1 >= 1.0f)
        voice.phase1 -= 1.0f;
      if (voice.phase2 >= 1.0f)
        voice.phase2 -= 1.0f;

      // Simple stereo spread
      leftSample += voiceSample;
      rightSample += voiceSample;
    }

    // Apply filter (lowpass with resonance)
    leftSample = processFilter(leftSample, 0);
    rightSample = processFilter(rightSample, 1);

    // Simple reverb (comb filter style)
    int reverbDelay = static_cast<int>(sampleRate_ * 0.1f); // 100ms delay
    int readIndex = (reverbWriteIndex_ - reverbDelay + reverbBuffer_.size()) %
                    reverbBuffer_.size();
    float reverbSample = reverbBuffer_[readIndex];

    // Mix dry and wet
    float dryAmount = 1.0f - reverbMix_;
    float wetAmount = reverbMix_;
    float mixedLeft = leftSample * dryAmount + reverbSample * wetAmount;
    float mixedRight = rightSample * dryAmount + reverbSample * wetAmount;

    // Write to reverb buffer
    reverbBuffer_[reverbWriteIndex_] =
        (leftSample + rightSample) * 0.5f * reverbDecay_;
    reverbWriteIndex_ = (reverbWriteIndex_ + 1) % reverbBuffer_.size();

    // Apply master gain and soft clip
    mixedLeft = softClip(mixedLeft * masterGain_);
    mixedRight = softClip(mixedRight * masterGain_);

    // Write to stereo interleaved output
    output[frame * 2] = mixedLeft;
    output[frame * 2 + 1] = mixedRight;
  }
}

float CriosferaEngine::generateOscillator(float phase, OscType type) {
  switch (type) {
  case OscType::Sawtooth:
    // Naive sawtooth: 2 * phase - 1
    return 2.0f * phase - 1.0f;

  case OscType::Sine:
    return std::sin(phase * TWO_PI);

  case OscType::Triangle:
    return 4.0f * std::abs(phase - 0.5f) - 1.0f;

  default:
    return 0.0f;
  }
}

float CriosferaEngine::processFilter(float input, int channel) {
  // Simple 2-pole lowpass filter with resonance
  // Attempt at a Moog-style ladder approximation

  float cutoffNorm = filterCutoff_ / static_cast<float>(sampleRate_);
  cutoffNorm = std::clamp(cutoffNorm, 0.001f, 0.49f);

  float k = 2.0f * std::sin(3.14159f * cutoffNorm);
  float q = 1.0f - filterResonance_ * 0.9f; // Prevent self-oscillation

  // Feedback
  float feedback = filterState_[channel][1] * filterResonance_ * 4.0f;
  input -= feedback;
  input = std::clamp(input, -1.0f, 1.0f);

  // Two pole cascade
  filterState_[channel][0] += k * (input - filterState_[channel][0]);
  filterState_[channel][1] +=
      k * (filterState_[channel][0] - filterState_[channel][1]);

  return filterState_[channel][1];
}

float CriosferaEngine::processLFO() {
  float lfoValue = std::sin(lfoPhase_ * TWO_PI);
  lfoPhase_ += lfoFrequency_ / static_cast<float>(sampleRate_);
  if (lfoPhase_ >= 1.0f)
    lfoPhase_ -= 1.0f;
  return lfoValue;
}

void CriosferaEngine::processEnvelope(Voice &voice) {
  float sampleTime = 1.0f / static_cast<float>(sampleRate_);

  switch (static_cast<int>(voice.envelopeStage)) {
  case 1: // Attack
    voice.envelopeLevel += sampleTime / attackTime_;
    if (voice.envelopeLevel >= 1.0f) {
      voice.envelopeLevel = 1.0f;
      voice.envelopeStage = 2; // Decay
    }
    break;

  case 2: // Decay
    voice.envelopeLevel -= sampleTime / decayTime_ * (1.0f - sustainLevel_);
    if (voice.envelopeLevel <= sustainLevel_) {
      voice.envelopeLevel = sustainLevel_;
      voice.envelopeStage = 3; // Sustain
    }
    break;

  case 3: // Sustain
    // Hold at sustain level
    break;

  case 4: // Release
    voice.envelopeLevel -= sampleTime / releaseTime_;
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

float CriosferaEngine::softClip(float x) {
  // Soft saturation
  if (x > 1.0f) {
    return 1.0f - std::exp(-x + 1.0f);
  } else if (x < -1.0f) {
    return -1.0f + std::exp(x + 1.0f);
  }
  return x;
}

void CriosferaEngine::updateParameters(const SynthState &state) {
  currentState_ = state;

  // Map parameters to synth controls
  // Pressure -> Filter cutoff (200Hz - 8000Hz)
  filterCutoff_ = 200.0f + state.pressure * 7800.0f;

  // Resonance -> Filter resonance
  filterResonance_ = state.resonance * 0.95f;

  // Viscosity -> Attack/Release time (affects envelope)
  attackTime_ = 0.01f + (1.0f - state.viscosity) * 0.5f;
  releaseTime_ = 0.1f + (1.0f - state.viscosity) * 1.5f;

  // Turbulence -> LFO depth
  lfoDepth_ = state.turbulence;
  lfoFrequency_ = 0.2f + state.turbulence * 2.0f;

  // Diffusion -> Reverb mix
  reverbMix_ = state.diffusion * 0.6f;
  reverbDecay_ = 0.3f + state.diffusion * 0.5f;
}

int32_t CriosferaEngine::playNote(float frequency, float velocity) {
  // Find an available voice
  Voice *freeVoice = nullptr;

  // First, try to find a completely free voice
  for (auto &voice : voices_) {
    if (!voice.active) {
      freeVoice = &voice;
      break;
    }
  }

  // If no free voice, steal the oldest releasing voice
  if (!freeVoice) {
    for (auto &voice : voices_) {
      if (voice.releasing) {
        freeVoice = &voice;
        break;
      }
    }
  }

  // If still no voice, steal the first one
  if (!freeVoice) {
    freeVoice = &voices_[0];
  }

  // Initialize the voice
  int32_t noteId = nextNoteId_++;
  freeVoice->id = noteId;
  freeVoice->frequency = frequency;
  freeVoice->velocity = velocity;
  freeVoice->phase1 = 0.0f;
  freeVoice->phase2 = 0.25f; // Start detuned osc at different phase
  freeVoice->envelopeLevel = 0.0f;
  freeVoice->envelopeStage = 1; // Attack
  freeVoice->active = true;
  freeVoice->releasing = false;

  return noteId;
}

void CriosferaEngine::stopNote(int32_t noteId) {
  for (auto &voice : voices_) {
    if (voice.id == noteId && voice.active) {
      voice.releasing = true;
      voice.envelopeStage = 4; // Release
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

  memset(filterState_, 0, sizeof(filterState_));
  std::fill(reverbBuffer_.begin(), reverbBuffer_.end(), 0.0f);
  lfoPhase_ = 0.0f;
}
