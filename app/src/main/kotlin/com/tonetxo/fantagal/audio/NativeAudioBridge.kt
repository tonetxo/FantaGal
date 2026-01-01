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
    private external fun nativeSetEngineEnabled(engineType: Int, enabled: Boolean)
    private external fun nativeSetSelectedEngine(engineType: Int)
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
     * Enable or disable a synth engine
     * Multiple engines can be enabled simultaneously
     */
    fun setEngineEnabled(engine: SynthEngine, enabled: Boolean) {
        nativeSetEngineEnabled(engine.ordinal, enabled)
    }

    /**
     * Set the currently selected engine for note routing
     * Notes from the keyboard will be sent to this engine
     */
    fun setSelectedEngine(engine: SynthEngine) {
        nativeSetSelectedEngine(engine.ordinal)
    }

    /**
     * Update synth parameters (applies to all engines)
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
     * Play a note on the selected engine
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
