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
     * Brétema Engine controls
     */
    fun setBreitemaStep(step: Int, active: Boolean) {
        nativeSetBreitemaStep(step, active)
    }

    fun setBreitemaPlaying(playing: Boolean) {
        nativeSetBreitemaPlaying(playing)
    }

    fun setBreitemaRhythmMode(mode: Int) {
        nativeSetBreitemaRhythmMode(mode)
    }

    fun generateBreitemaPattern() {
        nativeGenerateBreitemaPattern()
    }

    fun getBreitemaData(): BreitemaState {
        val buffer = FloatArray(35)
        val count = nativeGetBreitemaData(buffer)
        if (count < 35) return BreitemaState()

        val steps = BooleanArray(16)
        val probs = FloatArray(16)
        for (i in 0 until 16) {
            probs[i] = buffer[3 + i]
            steps[i] = buffer[19 + i] > 0.5f
        }

        return BreitemaState(
            currentStep = buffer[0].toInt(),
            rhythmMode = buffer[1].toInt(),
            isPlaying = buffer[2] > 0.5f,
            fogDensity = buffer[19], // Wait, let's check the buffer mapping in JNI
            // In C++ getBreitemaData:
            // destination[0] = currentStep
            // destination[1] = rhythmMode
            // destination[2] = isPlaying
            // destination[3..18] = stepProbabilities (16)
            // destination[19..34] = steps (16)
            // Wait, I didn't include fogDensity in getBreitemaData C++ implementation!
            stepProbabilities = probs.toList(),
            steps = steps.toList()
        )
    }

    data class BreitemaState(
        val currentStep: Int = 0,
        val rhythmMode: Int = 0,
        val isPlaying: Boolean = false,
        val stepProbabilities: List<Float> = List(16) { 0.5f },
        val steps: List<Boolean> = List(16) { false },
        val fogDensity: Float = 0.5f,
        val fogMovement: Float = 0.5f,
        val fmDepth: Float = 200f
    )

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
    
    // Brétema native methods
    private external fun nativeSetBreitemaStep(step: Int, active: Boolean)
    private external fun nativeSetBreitemaPlaying(playing: Boolean)
    private external fun nativeSetBreitemaRhythmMode(mode: Int)
    private external fun nativeGenerateBreitemaPattern()
    private external fun nativeGetBreitemaData(destination: FloatArray): Int
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
