package com.tonetxo.fantagal.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tonetxo.fantagal.audio.NativeAudioBridge
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.audio.SynthState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * SynthViewModel - Main ViewModel for the synthesizer
 *
 * Manages UI state and bridges to the native audio engine.
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

    // Engine active state - starts OFF (user must tap to activate)
    private val _isEngineActive = MutableStateFlow(false)
    val isEngineActive: StateFlow<Boolean> = _isEngineActive.asStateFlow()

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
     * Toggle engine on/off
     */
    fun toggleEngine() {
        _isEngineActive.value = !_isEngineActive.value
        if (!_isEngineActive.value) {
            // When turning off, stop all notes
            allNotesOff()
        }
    }

    /**
     * Toggle a note on/off
     */
    fun toggleNote(frequency: Float, velocity: Float = 0.8f) {
        if (!_isEngineActive.value) return // Don't play if engine is off

        if (_activeNotes.value.contains(frequency)) {
            // Note is playing, stop it
            noteOff(frequency)
        } else {
            // Note is not playing, start it
            noteOn(frequency, velocity)
        }
    }

    /**
     * Update a single parameter
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

    /**
     * Push current state to native engine
     */
    private fun pushParametersToEngine() {
        audioBridge.updateParameters(_synthState.value)
    }

    /**
     * Switch synth engine
     */
    fun switchEngine(engine: SynthEngine) {
        _currentEngine.value = engine
        audioBridge.switchEngine(engine)
    }

    /**
     * Play a note (note on)
     */
    fun noteOn(frequency: Float, velocity: Float = 0.8f) {
        if (!_isEngineActive.value) return

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

    override fun onCleared() {
        super.onCleared()
        audioBridge.stop()
    }
}
