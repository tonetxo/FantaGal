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

  // Pre-allocate all buffers
  carrierBuffer_.resize(framesPerBuffer, 0.0f);
  modChunk_.resize(framesPerBuffer, 0.0f);
  vocOutput_.resize(framesPerBuffer, 0.0f);
}

void VocoderEngine::process(float *output, int32_t numFrames) {
  std::lock_guard<std::mutex> lock(stateMutex_);

  bool hasModulator = !modulatorBuffer_.empty();

  // Ensure buffer sizes (check modChunk_ since carrierBuffer_ might be resized
  // separately)
  if (modChunk_.size() < static_cast<size_t>(numFrames)) {
    carrierBuffer_.resize(numFrames, 0.0f);
    modChunk_.resize(numFrames, 0.0f);
    vocOutput_.resize(numFrames, 0.0f);
  }

  // Clear modChunk and vocOutput before use
  std::fill(modChunk_.begin(), modChunk_.begin() + numFrames, 0.0f);
  std::fill(vocOutput_.begin(), vocOutput_.begin() + numFrames, 0.0f);

  // Prepare mono modulator chunk
  if (hasModulator) {
    for (int i = 0; i < numFrames; i++) {
      modChunk_[i] = modulatorBuffer_[modulatorReadIndex_];
      modulatorReadIndex_ = (modulatorReadIndex_ + 1) % modulatorBuffer_.size();
    }
  }

  // Process through vocoder (mono output)
  processor_->process(modChunk_.data(), carrierBuffer_.data(),
                      vocOutput_.data(), numFrames);

  // Interleave to stereo output
  for (int i = 0; i < numFrames; i++) {
    float sample = vocOutput_[i] * masterGain_;
    output[i * 2] = sample;
    output[i * 2 + 1] = sample;
  }

  // Clear carrier buffer after use to avoid "ghost" carriers if engines stop
  std::fill(carrierBuffer_.begin(), carrierBuffer_.begin() + numFrames, 0.0f);
}

void VocoderEngine::updateParameters(const SynthState &state) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  currentState_ = state;

  // Presión = Intensity / Gain (ranxo reducido para evitar distorsión)
  // Rango anterior: 0.5-7.0 (causaba distorsión)
  // Rango novo: 0.5-3.0 (máis controlado)
  static constexpr float MIN_MASTER_GAIN = 0.5f;
  static constexpr float MAX_MASTER_GAIN = 3.0f;
  masterGain_ =
      MIN_MASTER_GAIN + state.pressure * (MAX_MASTER_GAIN - MIN_MASTER_GAIN);
  processor_->setIntensity(state.pressure);

  // Resonancia = Q das bandas
  processor_->setResonance(state.resonance);

  // Viscosidade = Noise Threshold (Porta de ruído)
  processor_->setNoiseThreshold(state.viscosity);

  // Tormenta = Mix de Vocoder / Portadora Seca
  processor_->setMix(state.turbulence);

  // Difusión = Tempo de Relaxación (Release) dos filtros
  processor_->setDiffusion(state.diffusion);
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

float VocoderEngine::getVULevel() {
  std::lock_guard<std::mutex> lock(stateMutex_);
  if (!processor_)
    return 0.0f;
  return processor_->getModulatorRMS();
}
