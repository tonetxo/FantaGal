#pragma once

#include "BaseSynthEngine.h"
#include <array>
#include <memory>
#include <mutex>
#include <oboe/Oboe.h>
#include <vector>

// Engine type constants
constexpr int ENGINE_CRIOSFERA = 0;
constexpr int ENGINE_GEARHEART = 1;
constexpr int ENGINE_ECHO_VESSEL = 2;
constexpr int ENGINE_VOCODER = 3;
constexpr int ENGINE_BREITEMA = 4;
constexpr int ENGINE_COUNT = 5;

/**
 * NativeAudioEngine - Central audio manager using Oboe
 *
 * Manages the Oboe audio stream and processes audio from multiple
 * synth engines simultaneously, mixing their outputs.
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
   * Enable or disable an engine
   * @param engineType Engine index (0-4)
   * @param enabled Whether the engine should produce audio
   */
  void setEngineEnabled(int engineType, bool enabled);

  /**
   * Check if an engine is enabled
   */
  bool isEngineEnabled(int engineType) const;

  /**
   * Update synth parameters for ALL engines (deprecated - use
   * updateEngineParameters)
   */
  void updateParameters(float pressure, float resonance, float viscosity,
                        float turbulence, float diffusion);

  /**
   * Update synth parameters for a SPECIFIC engine only
   * This ensures engine independence
   */
  void updateEngineParameters(int engineType, float pressure, float resonance,
                              float viscosity, float turbulence,
                              float diffusion);

  /**
   * Play a note on all enabled engines that support it
   */
  int32_t playNote(float frequency, float velocity);

  /**
   * Stop a note on all engines
   */
  void stopNote(int32_t noteId);

  /**
   * Get the current sample rate
   */
  int32_t getSampleRate() const { return sampleRate_; }

  /**
   * Update gear state for Gearheart Engine
   */
  void updateGear(int32_t id, float speed, bool isConnected, int material,
                  float radius, int depth);
  void updateGearPosition(int32_t id, float x, float y);

  // Fill array with gear data: [id, x, y, speed, isConnected, material, radius,
  // depth] * 5 Returns number of gears written
  int32_t getGearData(float *destination, int32_t capacity);

  /**
   * Set the currently selected engine for UI focus (for note routing)
   */
  void setSelectedEngine(int engineType);

  /**
   * Brétema Engine controls
   */
  void setBreitemaStep(int32_t step, bool active);
  void setBreitemaPlaying(bool playing);
  void setBreitemaRhythmMode(int32_t mode);
  void generateBreitemaPattern();
  // Returns [currentStep, rhythmMode, isPlaying, step0_prob, ..., step15_prob,
  // step0_active, ..., step15_active] Total: 3 + 16 + 16 = 35 floats
  int32_t getBreitemaData(float *destination, int32_t capacity);

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
  void initializeEngines();

  std::shared_ptr<oboe::AudioStream> stream_;

  // Multiple engines - all instantiated, individually enabled
  std::array<std::unique_ptr<BaseSynthEngine>, ENGINE_COUNT> engines_;
  std::array<bool, ENGINE_COUNT> engineEnabled_ = {false};

  // Temporary buffer for mixing
  std::vector<float> mixBuffer_;

  std::mutex engineMutex_;
  int selectedEngineType_ = ENGINE_CRIOSFERA; // For note routing

  int32_t sampleRate_ = 48000;
  int32_t framesPerBuffer_ = 256;
  int channelCount_ = 2; // Stereo

  SynthState currentState_;
  bool isRunning_ = false;
};
