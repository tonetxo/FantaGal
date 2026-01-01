#include "NativeAudioEngine.h"
#include "engines/CriosferaEngine.h"
#include <android/log.h>

#define LOG_TAG "NativeAudioEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

NativeAudioEngine &NativeAudioEngine::getInstance() {
  static NativeAudioEngine instance;
  return instance;
}

NativeAudioEngine::NativeAudioEngine() {
  // Initialize with Criosfera engine by default
  currentEngine_ = std::make_unique<CriosferaEngine>();
}

NativeAudioEngine::~NativeAudioEngine() { stop(); }

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

  // Prepare the engine
  if (currentEngine_) {
    currentEngine_->prepare(sampleRate_, framesPerBuffer_);
  }

  LOGI("Stream opened: %d Hz, %d channels, %d frames/burst", sampleRate_,
       channelCount_, framesPerBuffer_);
}

void NativeAudioEngine::restartStream() {
  stop();
  start();
}

void NativeAudioEngine::switchEngine(int engineType) {
  std::lock_guard<std::mutex> lock(engineMutex_);

  // For now, only Criosfera is implemented
  switch (engineType) {
  case 0:
  default:
    currentEngine_ = std::make_unique<CriosferaEngine>();
    break;
    // Future engines:
    // case 1: currentEngine_ = std::make_unique<GearheartEngine>(); break;
    // case 2: currentEngine_ = std::make_unique<EchoVesselEngine>(); break;
  }

  if (currentEngine_) {
    currentEngine_->prepare(sampleRate_, framesPerBuffer_);
    currentEngine_->updateParameters(currentState_);
  }
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
  if (currentEngine_) {
    currentEngine_->updateParameters(currentState_);
  }
}

int32_t NativeAudioEngine::playNote(float frequency, float velocity) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (currentEngine_) {
    return currentEngine_->playNote(frequency, velocity);
  }
  return -1;
}

void NativeAudioEngine::stopNote(int32_t noteId) {
  std::lock_guard<std::mutex> lock(engineMutex_);
  if (currentEngine_) {
    currentEngine_->stopNote(noteId);
  }
}

oboe::DataCallbackResult
NativeAudioEngine::onAudioReady(oboe::AudioStream *audioStream, void *audioData,
                                int32_t numFrames) {

  auto *output = static_cast<float *>(audioData);

  // Clear buffer
  memset(output, 0, numFrames * channelCount_ * sizeof(float));

  // Process audio through current engine
  {
    std::lock_guard<std::mutex> lock(engineMutex_);
    if (currentEngine_) {
      currentEngine_->process(output, numFrames);
    }
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
