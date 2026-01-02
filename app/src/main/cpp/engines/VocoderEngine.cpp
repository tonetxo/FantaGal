#include "VocoderEngine.h"
#include <algorithm>
#include <memory>

VocoderEngine::VocoderEngine() {
  processor_ = std::make_unique<VocoderProcessor>(
      48000.0f); // Default, will be updated in prepare
}

void VocoderEngine::prepare(int32_t sampleRate, int32_t framesPerBuffer) {
  sampleRate_ = sampleRate;
  framesPerBuffer_ = framesPerBuffer;
  processor_ =
      std::make_unique<VocoderProcessor>(static_cast<float>(sampleRate));
  carrierBuffer_.resize(framesPerBuffer, 0.0f);
}

void VocoderEngine::process(float *output, int32_t numFrames) {
  std::lock_guard<std::mutex> lock(stateMutex_);

  if (modulatorBuffer_.empty()) {
    std::fill(output, output + numFrames * 2, 0.0f);
    return;
  }

  // Ensure carrier buffer size
  if (carrierBuffer_.size() < static_cast<size_t>(numFrames)) {
    carrierBuffer_.resize(numFrames, 0.0f);
  }

  // Prepare mono modulator chunk
  std::vector<float> modChunk(numFrames, 0.0f);
  for (int i = 0; i < numFrames; i++) {
    modChunk[i] = modulatorBuffer_[modulatorReadIndex_];
    modulatorReadIndex_ = (modulatorReadIndex_ + 1) % modulatorBuffer_.size();
  }

  // Process through vocoder (mono output)
  std::vector<float> vocOutput(numFrames, 0.0f);
  processor_->process(modChunk.data(), carrierBuffer_.data(), vocOutput.data(),
                      numFrames);

  // Interleave to stereo output
  for (int i = 0; i < numFrames; i++) {
    float sample = vocOutput[i] * masterGain_;
    output[i * 2] = sample;
    output[i * 2 + 1] = sample;
  }

  // Clear carrier buffer after use to avoid "ghost" carriers if engines stop
  std::fill(carrierBuffer_.begin(), carrierBuffer_.end(), 0.0f);
}

void VocoderEngine::updateParameters(const SynthState &state) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  currentState_ = state;

  // Presión = Intensity / Gain
  masterGain_ = 0.2f + state.pressure * 1.8f;
  processor_->setIntensity(state.pressure);

  // Resonancia = Q das bandas
  processor_->setResonance(state.resonance);

  // Viscosidade = Noise Threshold (Gate)
  processor_->setNoiseThreshold(state.viscosity);

  // Tormenta = (Sin uso claro aún, tal vez mezcla con carrier seco)
  processor_->setMix(state.turbulence);

  // Difusión = (Sin uso aún)
}

int32_t VocoderEngine::playNote(float frequency, float velocity) {
  // Vocoder doesn't respond to notes directly in this mode (it uses external
  // carrier)
  return -1;
}

void VocoderEngine::stopNote(int32_t noteId) {}

void VocoderEngine::reset() {
  std::lock_guard<std::mutex> lock(stateMutex_);
  modulatorReadIndex_ = 0;
}

void VocoderEngine::setModulatorBuffer(const float *data, int32_t numSamples) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  modulatorBuffer_.assign(data, data + numSamples);
  modulatorReadIndex_ = 0;
}

void VocoderEngine::setCarrierBuffer(const float *data, int32_t numFrames) {
  // This is called by NativeAudioEngine BEFORE process()
  std::lock_guard<std::mutex> lock(stateMutex_);
  if (carrierBuffer_.size() < static_cast<size_t>(numFrames)) {
    carrierBuffer_.resize(numFrames);
  }
  std::copy(data, data + numFrames, carrierBuffer_.begin());
}
