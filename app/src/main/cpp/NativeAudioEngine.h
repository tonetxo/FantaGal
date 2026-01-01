#pragma once

#include "BaseSynthEngine.h"
#include <memory>
#include <mutex>
#include <oboe/Oboe.h>

/**
 * NativeAudioEngine - Central audio manager using Oboe
 *
 * Manages the Oboe audio stream and delegates audio processing
 * to the currently active synth engine.
 */
class NativeAudioEngine : public oboe::AudioStreamCallback {
public:
  static NativeAudioEngine &getInstance();

  // Prevent copying
  NativeAudioEngine(const NativeAudioEngine &) = delete;
  NativeAudioEngine &operator=(const NativeAudioEngine &) = delete;

  /**
   * Initialize the audio engine and start the stream
   */
  bool start();

  /**
   * Stop the audio stream
   */
  void stop();

  /**
   * Switch to a different synth engine
   * @param engineType 0 = Criosfera, 1 = Gearheart, etc.
   */
  void switchEngine(int engineType);

  /**
   * Update synth parameters
   */
  void updateParameters(float pressure, float resonance, float viscosity,
                        float turbulence, float diffusion);

  /**
   * Play a note on the current engine
   */
  int32_t playNote(float frequency, float velocity);

  /**
   * Stop a note on the current engine
   */
  void stopNote(int32_t noteId);

  /**
   * Get the current sample rate
   */
  int32_t getSampleRate() const { return sampleRate_; }

  // Oboe callback
  oboe::DataCallbackResult onAudioReady(oboe::AudioStream *audioStream,
                                        void *audioData,
                                        int32_t numFrames) override;

  // Error callback
  void onErrorBeforeClose(oboe::AudioStream *audioStream,
                          oboe::Result error) override;
  void onErrorAfterClose(oboe::AudioStream *audioStream,
                         oboe::Result error) override;

private:
  NativeAudioEngine();
  ~NativeAudioEngine();

  void createStream();
  void restartStream();

  std::shared_ptr<oboe::AudioStream> stream_;
  std::unique_ptr<BaseSynthEngine> currentEngine_;
  std::mutex engineMutex_;

  int32_t sampleRate_ = 48000;
  int32_t framesPerBuffer_ = 256;
  int channelCount_ = 2; // Stereo

  SynthState currentState_;
  bool isRunning_ = false;
};
