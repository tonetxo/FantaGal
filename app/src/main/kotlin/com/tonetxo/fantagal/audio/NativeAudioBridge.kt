package com.tonetxo.fantagal.audio

/**
 * NativeAudioBridge - Kotlin wrapper for the native C++ audio engine
 *
 * Provides a clean Kotlin API over the JNI calls to the native audio engine.
 */
class NativeAudioBridge {

    companion object {
        init {
            System.loadLibrary("fantagal_audio")
        }
    }

    // JNI methods
    private external fun nativeInit()
    private external fun nativeStop()
    private external fun nativeSwitchEngine(engineType: Int)
    private external fun nativeUpdateParameters(
        pressure: Float,
        resonance: Float,
        viscosity: Float,
        turbulence: Float,
        diffusion: Float
    )
    private external fun nativePlayNote(frequency: Float, velocity: Float): Int
    private external fun nativeStopNote(noteId: Int)
    private external fun nativeGetSampleRate(): Int
    private external fun nativeUpdateGear(id: Int, speed: Float, isConnected: Boolean, material: Int, radius: Float)

    /**
     * Initialize and start the audio engine
     */
    fun start() {
        nativeInit()
    }

    /**
     * Stop the audio engine
     */
    fun stop() {
        nativeStop()
    }

    /**
     * Switch to a different synth engine
     */
    fun switchEngine(engine: SynthEngine) {
        nativeSwitchEngine(engine.ordinal)
    }

    /**
     * Update synth parameters
     */
    fun updateParameters(state: SynthState) {
        nativeUpdateParameters(
            state.pressure,
            state.resonance,
            state.viscosity,
            state.turbulence,
            state.diffusion
        )
    }

    /**
     * Play a note
     * @return Note ID for later stopping
     */
    fun playNote(frequency: Float, velocity: Float = 0.8f): Int {
        return nativePlayNote(frequency, velocity)
    }

    /**
     * Stop a playing note
     */
    fun stopNote(noteId: Int) {
        nativeStopNote(noteId)
    }

    /**
     * Get the current sample rate
     */
    fun getSampleRate(): Int {
        return nativeGetSampleRate()
    }

    /**
     * Update gear state for Gearheart engine
     */
    fun updateGear(id: Int, speed: Float, isConnected: Boolean, material: Int, radius: Float) {
        nativeUpdateGear(id, speed, isConnected, material, radius)
    }
}

/**
 * Available synth engines
 */
enum class SynthEngine {
    CRIOSFERA,
    GEARHEART,
    ECHO_VESSEL,
    VOCODER,
    BREITEMA
}
