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

    // Track active notes
    private val activeNotes = mutableMapOf<Float, Int>()

    init {
        // Start the audio engine
        viewModelScope.launch {
            audioBridge.start()
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
        val noteId = audioBridge.playNote(frequency, velocity)
        activeNotes[frequency] = noteId
        _isPlaying.value = true
    }

    /**
     * Stop a note (note off)
     */
    fun noteOff(frequency: Float) {
        activeNotes[frequency]?.let { noteId ->
            audioBridge.stopNote(noteId)
            activeNotes.remove(frequency)
        }
        if (activeNotes.isEmpty()) {
            _isPlaying.value = false
        }
    }

    /**
     * Stop all notes
     */
    fun allNotesOff() {
        activeNotes.values.forEach { noteId ->
            audioBridge.stopNote(noteId)
        }
        activeNotes.clear()
        _isPlaying.value = false
    }

    override fun onCleared() {
        super.onCleared()
        audioBridge.stop()
    }
}
