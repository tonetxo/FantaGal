#include "../NativeAudioEngine.h"
#include <android/log.h>
#include <jni.h>

#define LOG_TAG "NativeAudioBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

extern "C" {

/**
 * Initialize the native audio engine
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeInit(JNIEnv *env,
                                                             jobject thiz) {
  LOGI("Initializing native audio engine");
  NativeAudioEngine::getInstance().start();
}

/**
 * Stop the native audio engine
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeStop(JNIEnv *env,
                                                             jobject thiz) {
  LOGI("Stopping native audio engine");
  NativeAudioEngine::getInstance().stop();
}

/**
 * Enable or disable an engine
 * @param engineType Engine index (0-4)
 * @param enabled Whether the engine should produce audio
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeSetEngineEnabled(
    JNIEnv *env, jobject thiz, jint engineType, jboolean enabled) {
  LOGI("Setting engine %d enabled: %s", engineType, enabled ? "true" : "false");
  NativeAudioEngine::getInstance().setEngineEnabled(engineType, enabled);
}

/**
 * Set the currently selected engine for UI focus (note routing)
 * @param engineType Engine index (0-4)
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeSetSelectedEngine(
    JNIEnv *env, jobject thiz, jint engineType) {
  LOGI("Setting selected engine: %d", engineType);
  NativeAudioEngine::getInstance().setSelectedEngine(engineType);
}

/**
 * Update synth parameters
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeUpdateParameters(
    JNIEnv *env, jobject thiz, jfloat pressure, jfloat resonance,
    jfloat viscosity, jfloat turbulence, jfloat diffusion) {
  NativeAudioEngine::getInstance().updateParameters(
      pressure, resonance, viscosity, turbulence, diffusion);
}

/**
 * Play a note
 * @param frequency Note frequency in Hz
 * @param velocity Note velocity (0.0 - 1.0)
 * @return Note ID for stopping
 */
JNIEXPORT jint JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativePlayNote(
    JNIEnv *env, jobject thiz, jfloat frequency, jfloat velocity) {
  return NativeAudioEngine::getInstance().playNote(frequency, velocity);
}

/**
 * Stop a note
 * @param noteId The note ID returned by playNote
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeStopNote(JNIEnv *env,
                                                                 jobject thiz,
                                                                 jint noteId) {
  NativeAudioEngine::getInstance().stopNote(noteId);
}

/**
 * Get the current sample rate
 */
JNIEXPORT jint JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeGetSampleRate(
    JNIEnv *env, jobject thiz) {
  return NativeAudioEngine::getInstance().getSampleRate();
}

/**
 * Update gear for Gearheart engine
 */
JNIEXPORT void JNICALL
Java_com_tonetxo_fantagal_audio_NativeAudioBridge_nativeUpdateGear(
    JNIEnv *env, jobject thiz, jint id, jfloat speed, jboolean isConnected,
    jint material, jfloat radius) {
  NativeAudioEngine::getInstance().updateGear(id, speed, isConnected, material,
                                              radius);
}

} // extern "C"
