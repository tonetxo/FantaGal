#include "VocoderEngine.h"
#include <jni.h>
#include <vector>

static VocoderEngine *engine = nullptr;

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_create(JNIEnv *env,
                                                           jobject thiz) {
  if (engine == nullptr) {
    engine = new VocoderEngine();
  }
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_start(JNIEnv *env,
                                                          jobject thiz) {
  if (engine != nullptr) {
    return engine->start();
  }
  return false;
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_stop(JNIEnv *env,
                                                         jobject thiz) {
  if (engine != nullptr) {
    engine->stop();
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_destroy(JNIEnv *env,
                                                            jobject thiz) {
  if (engine != nullptr) {
    delete engine;
    engine = nullptr;
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setPitch(JNIEnv *env,
                                                             jobject thiz,
                                                             jfloat pitch) {
  if (engine != nullptr) {
    engine->setPitch(pitch);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setIntensity(
    JNIEnv *env, jobject thiz, jfloat intensity) {
  if (engine != nullptr) {
    engine->setIntensity(intensity);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setWaveform(JNIEnv *env,
                                                                jobject thiz,
                                                                jint type) {
  if (engine != nullptr) {
    engine->setWaveform(type);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setVibrato(JNIEnv *env,
                                                               jobject thiz,
                                                               jfloat amount) {
  if (engine != nullptr) {
    engine->setVibrato(amount);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setEcho(JNIEnv *env,
                                                            jobject thiz,
                                                            jfloat amount) {
  if (engine != nullptr) {
    engine->setEcho(amount);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setTremolo(JNIEnv *env,
                                                               jobject thiz,
                                                               jfloat amount) {
  if (engine != nullptr) {
    engine->setTremolo(amount);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setNoiseThreshold(
    JNIEnv *env, jobject thiz, jfloat threshold) {
  if (engine != nullptr) {
    engine->setNoiseThreshold(threshold);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setSource(JNIEnv *env,
                                                              jobject thiz,
                                                              jint source) {
  if (engine != nullptr) {
    engine->setSource(source);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_loadModulatorData(
    JNIEnv *env, jobject thiz, jfloatArray data) {
  if (engine != nullptr && data != nullptr) {
    jsize len = env->GetArrayLength(data);
    jfloat *body = env->GetFloatArrayElements(data, nullptr);
    engine->setModulatorBuffer(body, len);
    env->ReleaseFloatArrayElements(data, body, JNI_ABORT);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_setFilePlaying(
    JNIEnv *env, jobject thiz, jboolean playing) {
  if (engine != nullptr) {
    engine->setFilePlaying(playing);
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_resetFileIndex(
    JNIEnv *env, jobject thiz) {
  if (engine != nullptr) {
    engine->resetFileIndex();
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_startRecording(
    JNIEnv *env, jobject thiz) {
  if (engine != nullptr) {
    engine->startRecording();
  }
}

extern "C" JNIEXPORT void JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_stopRecording(
    JNIEnv *env, jobject thiz) {
  if (engine != nullptr) {
    engine->stopRecording();
  }
}

extern "C" JNIEXPORT jfloat JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_getVULevel(JNIEnv *env,
                                                               jobject thiz) {
  if (engine != nullptr) {
    return engine->getVULevel();
  }
  return 0.0f;
}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_antigravity_vocodergal_audio_VocoderBridge_getWaveformData(
    JNIEnv *env, jobject thiz) {
  if (engine != nullptr) {
    auto data = engine->getWaveformData();
    jfloatArray result = env->NewFloatArray(data.size());
    env->SetFloatArrayRegion(result, 0, data.size(), data.data());
    return result;
  }
  return nullptr;
}
