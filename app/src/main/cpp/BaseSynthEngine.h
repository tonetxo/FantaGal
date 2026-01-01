#pragma once

#include "SynthState.h"
#include <cstdint>

/**
 * BaseSynthEngine - Abstract base class for all synth engines
 *
 * This mirrors the TypeScript ISynthEngine interface and provides
 * the foundation for all engine implementations in C++.
 */
class BaseSynthEngine {
public:
  virtual ~BaseSynthEngine() = default;

  /**
   * Prepare the engine for audio processing
   * @param sampleRate The audio sample rate (e.g., 44100, 48000)
   * @param framesPerBuffer Number of frames per audio callback
   */
  virtual void prepare(int32_t sampleRate, int32_t framesPerBuffer) = 0;

  /**
   * Process audio and fill the output buffer
   * @param output Pointer to stereo interleaved output buffer
   * @param numFrames Number of frames to generate
   */
  virtual void process(float *output, int32_t numFrames) = 0;

  /**
   * Update synth parameters from UI state
   * @param state Current synth state from UI
   */
  virtual void updateParameters(const SynthState &state) = 0;

  /**
   * Trigger a note at the specified frequency
   * @param frequency Note frequency in Hz
   * @param velocity Note velocity (0.0 - 1.0)
   * @return Note ID for later stopping, or -1 if failed
   */
  virtual int32_t playNote(float frequency, float velocity = 0.8f) = 0;

  /**
   * Stop a playing note by ID
   * @param noteId The note ID returned by playNote
   */
  virtual void stopNote(int32_t noteId) = 0;

  /**
   * Reset engine to initial state
   */
  virtual void reset() = 0;

protected:
  int32_t sampleRate_ = 44100;
  int32_t framesPerBuffer_ = 256;
  SynthState currentState_;
};
