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
     * Update synth parameters (applies to all engines - DEPRECATED)
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
     * Update synth parameters for a SPECIFIC engine only (INDEPENDENT)
     */
    fun updateEngineParameters(engine: SynthEngine, state: SynthState) {
        nativeUpdateEngineParameters(
            engine.ordinal,
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
    fun updateGear(id: Int, speed: Float, isConnected: Boolean, material: Int, radius: Float, depth: Int) {
        nativeUpdateGear(id, speed, isConnected, material, radius, depth)
    }

    fun updateGearPosition(id: Int, x: Float, y: Float) {
        nativeUpdateGearPosition(id, x, y)
    }

    /**
     * Get gear states from native engine (for persistence)
     */
    fun getGearStates(): List<GearData> {
        val size = 5 // max gears
        val stride = 10 // id, x, y, speed, isConnected, material, radius, depth, teeth, angle
        val buffer = FloatArray(size * stride)
        val count = nativeGetGearData(buffer)

        val gears = mutableListOf<GearData>()
        for (i in 0 until count) {
            val idx = i * stride
            gears.add(GearData(
                id = buffer[idx].toInt(),
                x = buffer[idx + 1],
                y = buffer[idx + 2],
                speed = buffer[idx + 3],
                isConnected = buffer[idx + 4] > 0.5f,
                material = buffer[idx + 5].toInt(),
                radius = buffer[idx + 6],
                depth = buffer[idx + 7].toInt(),
                teeth = buffer[idx + 8].toInt(),
                angle = buffer[idx + 9]
            ))
        }
        return gears
    }

    // New generic data class for bridge transfer
    data class GearData(
        val id: Int,
        val x: Float,
        val y: Float,
        val speed: Float,
        val isConnected: Boolean,
        val material: Int,
        val radius: Float,
        val depth: Int,
        val teeth: Int,
        val angle: Float
    )

    private external fun nativeUpdateGear(id: Int, speed: Float, isConnected: Boolean, material: Int, radius: Float, depth: Int)
    private external fun nativeUpdateGearPosition(id: Int, x: Float, y: Float)
    private external fun nativeGetGearData(destination: FloatArray): Int
    private external fun nativeUpdateEngineParameters(engineType: Int, pressure: Float, resonance: Float, viscosity: Float, turbulence: Float, diffusion: Float)
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
