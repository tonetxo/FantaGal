#include "NativeAudioEngine.h"
#include "engines/BreitemaEngine.h"
#include "engines/CriosferaEngine.h"
#include "engines/GearheartEngine.h"
#include <algorithm>
#include <android/log.h>
#include <cmath>
#include <cstring>

#define LOG_TAG "NativeAudioEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

NativeAudioEngine &NativeAudioEngine::getInstance() {
  static NativeAudioEngine instance;
  return instance;
}

NativeAudioEngine::NativeAudioEngine() {
  // Initialize all engines
  initializeEngines();
}

NativeAudioEngine::~NativeAudioEngine() { stop(); }

void NativeAudioEngine::initializeEngines() {
  engines_[ENGINE_CRIOSFERA] = std::make_unique<CriosferaEngine>();
  engines_[ENGINE_GEARHEART] = std::make_unique<GearheartEngine>();
  engines_[ENGINE_BREITEMA] = std::make_unique<BreitemaEngine>();
  // Future engines will be initialized here when implemented:
  // engines_[ENGINE_ECHO_VESSEL] = std::make_unique<EchoVesselEngine>();
  // engines_[ENGINE_VOCODER] = std::make_unique<VocoderEngine>();

  LOGI("Initialized %d engines (Criosfera, Gearheart, Breitema)", 3);
}

bool NativeAudioEngine::start() {
  if (isRunning_)
    return true;

  createStream();

  if (stream_) {
    oboe::Result result = stream_->requestStart();
    if (result != oboe::Result::OK) {
      LOGE("Failed to start stream: %s", oboe::convertToText(result));
      return false;
    }
    isRunning_ = true;
    LOGI("Audio stream started: %d Hz, %d frames/buffer", sampleRate_,
         framesPerBuffer_);
    return true;
  }
  return false;
}

void NativeAudioEngine::stop() {
  if (stream_) {
    stream_->requestStop();
    stream_->close();
    stream_.reset();
  }
  isRunning_ = false;
  LOGI("Audio stream stopped");
}

void NativeAudioEngine::createStream() {
  oboe::AudioStreamBuilder builder;

  builder.setDirection(oboe::Direction::Output)
      ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
      ->setSharingMode(oboe::SharingMode::Exclusive)
      ->setFormat(oboe::AudioFormat::Float)
      ->setChannelCount(channelCount_)
      ->setSampleRate(sampleRate_)
      ->setFramesPerCallback(framesPerBuffer_)
      ->setCallback(this);

  oboe::Result result = builder.openStream(stream_);

  if (result != oboe::Result::OK) {
    LOGE("Failed to open stream: %s", oboe::convertToText(result));
    return;
  }

  // Update with actual values from the stream
  sampleRate_ = stream_->getSampleRate();
  framesPerBuffer_ = stream_->getFramesPerBurst();

  // Allocate mix buffer
  mixBuffer_.resize(framesPerBuffer_ * channelCount_);

  // Prepare all engines
  std::lock_guard<std::mutex> lock(engineMutex_);
  for (int i = 0; i < ENGINE_COUNT; i++) {
    if (engines_[i]) {
      engines_[i]->prepare(sampleRate_, framesPerBuffer_);
    }
  }

  LOGI("Stream opened: %d Hz, %d channels, %d frames/burst", sampleRate_,
       channelCount_, framesPerBuffer_);
}

void NativeAudioEngine::restartStream() {
  stop();
  start();
}

void NativeAudioEngine::setEngineEnabled(int engineType, bool enabled) {
  if (engineType < 0 || engineType >= ENGINE_COUNT) {
    LOGE("Invalid engine type: %d", engineType);
    return;
  }

  std::lock_guard<std::mutex> lock(engineMutex_);
  engineEnabled_[engineType] = enabled;
  // Note: We don't reset the engine on enable/disable to preserve state
  // (e.g., gear rotation angles in Gearheart)

  LOGI("Engine %d %s", engineType, enabled ? "enabled" : "disabled");
}

bool NativeAudioEngine::isEngineEnabled(int engineType) const {
  if (engineType < 0 || engineType >= ENGINE_COUNT) {
    return false;
  }
  return engineEnabled_[engineType];
}

void NativeAudioEngine::setSelectedEngine(int engineType) {
  if (engineType >= 0 && engineType < ENGINE_COUNT) {
    selectedEngineType_ = engineType;
    LOGI("Selected engine: %d", engineType);
  }
}

void NativeAudioEngine::updateGear(int32_t id, float speed, bool isConnected,
                                   int material, float radius, int depth) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[ENGINE_GEARHEART]) {
    auto *gearheart =
        static_cast<GearheartEngine *>(engines_[ENGINE_GEARHEART].get());
    gearheart->updateGear(id, speed, isConnected, material, radius, depth);
  }
}

void NativeAudioEngine::updateGearPosition(int32_t id, float x, float y) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[ENGINE_GEARHEART]) {
    auto *gearheart =
        static_cast<GearheartEngine *>(engines_[ENGINE_GEARHEART].get());
    gearheart->updateGearPosition(id, x, y);
  }
}

int32_t NativeAudioEngine::getGearData(float *destination, int32_t capacity) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (!engines_[ENGINE_GEARHEART])
    return 0;

  auto *gearheart =
      static_cast<GearheartEngine *>(engines_[ENGINE_GEARHEART].get());
  const auto &gears = gearheart->getGearStates();

  int count = 0;
  // Each gear takes 10 floats: id, x, y, speed, isConnected, material, radius,
  // depth, teeth, angle
  int stride = 10;

  for (const auto &gear : gears) {
    if ((count + 1) * stride > capacity)
      break;

    int idx = count * stride;
    destination[idx + 0] = (float)gear.id;
    destination[idx + 1] = gear.x;
    destination[idx + 2] = gear.y;
    destination[idx + 3] = gear.speed;
    destination[idx + 4] = gear.isConnected ? 1.0f : 0.0f;
    destination[idx + 5] = (float)gear.material;
    destination[idx + 6] = gear.radius;
    destination[idx + 7] = (float)gear.depth;
    destination[idx + 8] = (float)gear.teeth;
    destination[idx + 9] = gear.angle;

    count++;
  }
  return count;
}

void NativeAudioEngine::setBreitemaStep(int32_t step, bool active) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[ENGINE_BREITEMA]) {
    auto *breitema =
        static_cast<BreitemaEngine *>(engines_[ENGINE_BREITEMA].get());
    breitema->toggleStep(step);
  }
}

void NativeAudioEngine::setBreitemaPlaying(bool playing) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[ENGINE_BREITEMA]) {
    auto *breitema =
        static_cast<BreitemaEngine *>(engines_[ENGINE_BREITEMA].get());
    breitema->setPlaying(playing);
  }
}

void NativeAudioEngine::setBreitemaRhythmMode(int32_t mode) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[ENGINE_BREITEMA]) {
    auto *breitema =
        static_cast<BreitemaEngine *>(engines_[ENGINE_BREITEMA].get());
    breitema->setRhythmMode(mode);
  }
}

void NativeAudioEngine::generateBreitemaPattern() {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[ENGINE_BREITEMA]) {
    auto *breitema =
        static_cast<BreitemaEngine *>(engines_[ENGINE_BREITEMA].get());
    breitema->generateRandomPattern();
  }
}

int32_t NativeAudioEngine::getBreitemaData(float *destination,
                                           int32_t capacity) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (!engines_[ENGINE_BREITEMA] || capacity < 35)
    return 0;

  auto *breitema =
      static_cast<BreitemaEngine *>(engines_[ENGINE_BREITEMA].get());
  auto state = breitema->getBreitemaState();

  destination[0] = (float)state.currentStep;
  destination[1] = (float)state.rhythmMode;
  destination[2] = state.isPlaying ? 1.0f : 0.0f;

  for (int i = 0; i < 16; ++i) {
    destination[3 + i] = state.stepProbabilities[i];
  }
  for (int i = 0; i < 16; ++i) {
    destination[19 + i] = state.steps[i] ? 1.0f : 0.0f;
  }

  // Add extra parameters for UI visuals
  if (capacity >= 38) {
    destination[35] = state.fogDensity;
    destination[36] = state.fogMovement;
    destination[37] = state.fmDepth;
    return 38;
  }

  return 35;
}

void NativeAudioEngine::updateParameters(float pressure, float resonance,
                                         float viscosity, float turbulence,
                                         float diffusion) {
  currentState_.pressure = pressure;
  currentState_.resonance = resonance;
  currentState_.viscosity = viscosity;
  currentState_.turbulence = turbulence;
  currentState_.diffusion = diffusion;

  std::lock_guard<std::mutex> lock(engineMutex_);
  // Update all engines with the same parameters
  for (int i = 0; i < ENGINE_COUNT; i++) {
    if (engines_[i]) {
      engines_[i]->updateParameters(currentState_);
    }
  }
}

void NativeAudioEngine::updateEngineParameters(int engineType, float pressure,
                                               float resonance, float viscosity,
                                               float turbulence,
                                               float diffusion) {
  if (engineType < 0 || engineType >= ENGINE_COUNT)
    return;

  // Create engine-local state (does not affect currentState_)
  SynthState engineState;
  engineState.pressure = pressure;
  engineState.resonance = resonance;
  engineState.viscosity = viscosity;
  engineState.turbulence = turbulence;
  engineState.diffusion = diffusion;

  std::lock_guard<std::mutex> lock(engineMutex_);
  if (engines_[engineType]) {
    engines_[engineType]->updateParameters(engineState);
  }
}

int32_t NativeAudioEngine::playNote(float frequency, float velocity) {
  std::lock_guard<std::mutex> lock(engineMutex_);

  // Play note on the currently selected engine (for keyboard input)
  if (engines_[selectedEngineType_] && engineEnabled_[selectedEngineType_]) {
    return engines_[selectedEngineType_]->playNote(frequency, velocity);
  }

  // Fallback: play on first enabled engine
  for (int i = 0; i < ENGINE_COUNT; i++) {
    if (engines_[i] && engineEnabled_[i]) {
      return engines_[i]->playNote(frequency, velocity);
    }
  }

  return -1;
}

void NativeAudioEngine::stopNote(int32_t noteId) {
  std::lock_guard<std::mutex> lock(engineMutex_);

  // Stop note on all engines (since we don't track which engine played it)
  for (int i = 0; i < ENGINE_COUNT; i++) {
    if (engines_[i]) {
      engines_[i]->stopNote(noteId);
    }
  }
}

oboe::DataCallbackResult
NativeAudioEngine::onAudioReady(oboe::AudioStream *audioStream, void *audioData,
                                int32_t numFrames) {

  auto *output = static_cast<float *>(audioData);
  const int totalSamples = numFrames * channelCount_;

  // Clear output buffer
  std::memset(output, 0, totalSamples * sizeof(float));

  // Ensure mix buffer is large enough
  if (mixBuffer_.size() < static_cast<size_t>(totalSamples)) {
    mixBuffer_.resize(totalSamples);
  }

  // Process and mix all enabled engines
  {
    std::lock_guard<std::mutex> lock(engineMutex_);

    for (int i = 0; i < ENGINE_COUNT; i++) {
      if (engines_[i] && engineEnabled_[i]) {
        // Clear mix buffer for this engine
        std::memset(mixBuffer_.data(), 0, totalSamples * sizeof(float));

        // Process engine
        engines_[i]->process(mixBuffer_.data(), numFrames);

        // Add to output
        for (int j = 0; j < totalSamples; j++) {
          output[j] += mixBuffer_[j];
        }
      }
    }
  }
  // Apply master gain and soft clip to prevent distortion
  const float masterGain =
      0.6f; // Reduce overall level when mixing multiple engines
  for (int i = 0; i < totalSamples; i++) {
    float x = output[i] * masterGain;
    // Smooth tanh-like soft clip for natural saturation
    if (x > 0.5f) {
      x = 0.5f + 0.5f * std::tanh((x - 0.5f) * 2.0f);
    } else if (x < -0.5f) {
      x = -0.5f + 0.5f * std::tanh((x + 0.5f) * 2.0f);
    }
    output[i] = x;
  }

  return oboe::DataCallbackResult::Continue;
}

void NativeAudioEngine::onErrorBeforeClose(oboe::AudioStream *audioStream,
                                           oboe::Result error) {
  LOGE("Error before close: %s", oboe::convertToText(error));
}

void NativeAudioEngine::onErrorAfterClose(oboe::AudioStream *audioStream,
                                          oboe::Result error) {
  LOGE("Error after close: %s", oboe::convertToText(error));
  // Try to restart the stream
  if (error == oboe::Result::ErrorDisconnected) {
    restartStream();
  }
}
