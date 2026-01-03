#pragma once

#include "../BaseSynthEngine.h"
#include "VocoderProcessor.h"
#include <memory>
#include <mutex>
#include <vector>

/**
 * VocoderEngine - A 16-band vocoder engine that Uses other engines as carrier.
 */
class VocoderEngine : public BaseSynthEngine {
public:
  VocoderEngine();
  ~VocoderEngine() override = default;

  void prepare(int32_t sampleRate, int32_t framesPerBuffer) override;
  void process(float *output, int32_t numFrames) override;
  void updateParameters(const SynthState &state) override;
  int32_t playNote(float frequency, float velocity) override;
  void stopNote(int32_t noteId) override;
  void reset() override;

  // Vocoder specific methods
  void setModulatorBuffer(const float *data, int32_t numSamples);
  void setCarrierBuffer(const float *data, int32_t numFrames);
  float getVULevel();

private:
  float masterGain_ = 0.8f;
  std::unique_ptr<VocoderProcessor> processor_;

  // Modulator buffer (recorded voice)
  std::vector<float> modulatorBuffer_;
  int32_t modulatorReadIndex_ = 0;

  // Temporary buffers for processing (pre-allocated to avoid audio thread
  // allocation)
  std::vector<float> carrierBuffer_;
  std::vector<float> modChunk_;
  std::vector<float> vocOutput_;

  std::mutex stateMutex_;
};
