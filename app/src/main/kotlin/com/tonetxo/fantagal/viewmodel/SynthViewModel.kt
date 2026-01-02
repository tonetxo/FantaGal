package com.tonetxo.fantagal.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tonetxo.fantagal.audio.NativeAudioBridge
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.audio.SynthState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * SynthViewModel - Main ViewModel for the synthesizer
 *
 * Manages UI state and bridges to the native audio engine.
 * Supports multiple engines running simultaneously with independent activation.
 */
class SynthViewModel : ViewModel() {

    private val audioBridge = NativeAudioBridge()

    // UI State
    private val _synthState = MutableStateFlow(SynthState())
    val synthState: StateFlow<SynthState> = _synthState.asStateFlow()

    private val _currentEngine = MutableStateFlow(SynthEngine.CRIOSFERA)
    val currentEngine: StateFlow<SynthEngine> = _currentEngine.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    // Per-engine active states - each engine can be independently enabled
    private val _engineActiveStates = MutableStateFlow(
        SynthEngine.entries.associateWith { false }
    )
    val engineActiveStates: StateFlow<Map<SynthEngine, Boolean>> = _engineActiveStates.asStateFlow()

    // Track active notes (frequency -> noteId)
    private val _activeNotes = MutableStateFlow<Set<Float>>(emptySet())
    val activeNotes: StateFlow<Set<Float>> = _activeNotes.asStateFlow()

    private val noteIdMap = mutableMapOf<Float, Int>()

    init {
        // Start the audio engine
        viewModelScope.launch {
            audioBridge.start()
        }
    }

    /**
     * Toggle a specific engine on/off
     */
    fun toggleEngine(engine: SynthEngine) {
        val newState = !isEngineActive(engine)
        _engineActiveStates.update { states ->
            states.toMutableMap().apply { put(engine, newState) }
        }
        audioBridge.setEngineEnabled(engine, newState)
        // Note: Each engine manages its own state internally
        // We don't call allNotesOff() here as it would affect other engines
    }

    /**
     * Check if a specific engine is active
     */
    fun isEngineActive(engine: SynthEngine): Boolean {
        return _engineActiveStates.value[engine] ?: false
    }

    /**
     * Select an engine (for UI focus and note routing)
     */
    fun selectEngine(engine: SynthEngine) {
        _currentEngine.value = engine
        audioBridge.setSelectedEngine(engine)
    }

    /**
     * Toggle a note on/off
     */
    fun toggleNote(frequency: Float, velocity: Float = 0.8f) {
        // Check if the currently selected engine is active
        if (!isEngineActive(_currentEngine.value)) return

        if (_activeNotes.value.contains(frequency)) {
            // Note is playing, stop it
            noteOff(frequency)
        } else {
            // Note is not playing, start it
            noteOn(frequency, velocity)
        }
    }

    /**
     * Update a single parameter (GLOBAL - affects all engines)
     * @deprecated Use updateEngineParameter for engine-specific updates
     */
    fun updatePressure(value: Float) {
        _synthState.value = _synthState.value.copy(pressure = value)
        pushParametersToEngine()
    }

    fun updateResonance(value: Float) {
        _synthState.value = _synthState.value.copy(resonance = value)
        pushParametersToEngine()
    }

    fun updateViscosity(value: Float) {
        _synthState.value = _synthState.value.copy(viscosity = value)
        pushParametersToEngine()
    }

    fun updateTurbulence(value: Float) {
        _synthState.value = _synthState.value.copy(turbulence = value)
        pushParametersToEngine()
    }

    fun updateDiffusion(value: Float) {
        _synthState.value = _synthState.value.copy(diffusion = value)
        pushParametersToEngine()
    }

    // --- PER-ENGINE INDEPENDENT PARAMETER STATE ---
    private val engineStates = mutableMapOf<SynthEngine, MutableStateFlow<SynthState>>().apply {
        SynthEngine.entries.forEach { put(it, MutableStateFlow(SynthState())) }
    }
    
    /**
     * Get observable state for a specific engine
     */
    fun getEngineState(engine: SynthEngine): StateFlow<SynthState> {
        return engineStates[engine]?.asStateFlow() ?: _synthState.asStateFlow()
    }
    
    /**
     * Update a parameter for a SPECIFIC engine only (independent)
     */
    fun updateEngineParameter(engine: SynthEngine, param: String, value: Float) {
        val state = engineStates[engine] ?: return
        val newState = when (param) {
            "pressure" -> state.value.copy(pressure = value)
            "resonance" -> state.value.copy(resonance = value)
            "viscosity" -> state.value.copy(viscosity = value)
            "turbulence" -> state.value.copy(turbulence = value)
            "diffusion" -> state.value.copy(diffusion = value)
            else -> state.value
        }
        state.value = newState
        audioBridge.updateEngineParameters(engine, newState)
    }

    /**
     * Push current state to native engine (DEPRECATED - affects all)
     */
    private fun pushParametersToEngine() {
        audioBridge.updateParameters(_synthState.value)
    }

    /**
     * Play a note (note on)
     */
    fun noteOn(frequency: Float, velocity: Float = 0.8f) {
        // Check if current engine is active
        if (!isEngineActive(_currentEngine.value)) return

        val noteId = audioBridge.playNote(frequency, velocity)
        noteIdMap[frequency] = noteId
        _activeNotes.value = _activeNotes.value + frequency
        _isPlaying.value = true
    }

    /**
     * Stop a note (note off)
     */
    fun noteOff(frequency: Float) {
        noteIdMap[frequency]?.let { noteId ->
            audioBridge.stopNote(noteId)
            noteIdMap.remove(frequency)
        }
        _activeNotes.value = _activeNotes.value - frequency
        if (_activeNotes.value.isEmpty()) {
            _isPlaying.value = false
        }
    }

    /**
     * Stop all notes
     */
    fun allNotesOff() {
        noteIdMap.values.forEach { noteId ->
            audioBridge.stopNote(noteId)
        }
        noteIdMap.clear()
        _activeNotes.value = emptySet()
        _isPlaying.value = false
    }

    /**
     * Update gear state for Gearheart Engine
     */
    fun updateGear(id: Int, speed: Float, isConnected: Boolean, material: Int, radius: Float, depth: Int) {
        audioBridge.updateGear(id, speed, isConnected, material, radius, depth)
    }

    fun updateGearPosition(id: Int, x: Float, y: Float) {
        audioBridge.updateGearPosition(id, x, y)
    }

    fun getGearStates(): List<NativeAudioBridge.GearData> {
        return audioBridge.getGearStates()
    }

    // --- BRÉTIMA ENGINE CONTROL ---
    private val _breitemaState = MutableStateFlow(NativeAudioBridge.BreitemaState())
    val breitemaState: StateFlow<NativeAudioBridge.BreitemaState> = _breitemaState.asStateFlow()

    fun toggleBreitemaStep(step: Int) {
        audioBridge.setBreitemaStep(step, true) // toggle logic is native
        updateBreitemaState()
    }

    fun setBreitemaPlaying(playing: Boolean) {
        audioBridge.setBreitemaPlaying(playing)
        updateBreitemaState()
    }

    fun setBreitemaRhythmMode(mode: Int) {
        audioBridge.setBreitemaRhythmMode(mode)
        updateBreitemaState()
    }

    fun regenerateBreitemaPattern() {
        audioBridge.generateBreitemaPattern()
        updateBreitemaState()
    }

    fun updateBreitemaState() {
        _breitemaState.value = audioBridge.getBreitemaData()
    }

    override fun onCleared() {
        super.onCleared()
        audioBridge.stop()
    }
}
