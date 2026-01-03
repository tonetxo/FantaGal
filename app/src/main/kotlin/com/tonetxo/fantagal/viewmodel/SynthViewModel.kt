package com.tonetxo.fantagal.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.media.MediaRecorder.AudioSource
import com.tonetxo.fantagal.audio.NativeAudioBridge
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.audio.SynthState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

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

        // Poll for vocoder VU level (only when active)
        viewModelScope.launch {
            while (true) {
                if (isEngineActive(SynthEngine.VOCODER)) {
                    val vu = audioBridge.getVocoderVU()
                    _vocoderState.update { it.copy(vuLevel = vu) }
                }
                delay(50) // 20fps for VU meter
            }
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

    private val _vocoderState = MutableStateFlow(NativeAudioBridge.VocoderState())
    val vocoderState: StateFlow<NativeAudioBridge.VocoderState> = _vocoderState.asStateFlow()

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

    fun toggleVocoderRecording() {
        if (_vocoderState.value.isRecording) {
            stopRecording()
        } else {
            startRecording()
        }
    }

    private fun startRecording() {
        _vocoderState.update { it.copy(isRecording = true) }
        // We will implement actual recording in a coroutine on IO dispatcher
        viewModelScope.launch(Dispatchers.IO) {
            recordModulator()
        }
    }

    private fun stopRecording() {
        _vocoderState.update { it.copy(isRecording = false) }
    }

    private suspend fun recordModulator() {
        val sampleRate = 48000
        val bufferSizeSamples = sampleRate * 5 // 5 seconds max
        val recordBuffer = FloatArray(bufferSizeSamples)
        var totalRead = 0

        val minBufferSize = android.media.AudioRecord.getMinBufferSize(
            sampleRate,
            android.media.AudioFormat.CHANNEL_IN_MONO,
            android.media.AudioFormat.ENCODING_PCM_FLOAT
        )

        try {
            val audioRecord = android.media.AudioRecord(
                AudioSource.MIC,
                sampleRate,
                android.media.AudioFormat.CHANNEL_IN_MONO,
                android.media.AudioFormat.ENCODING_PCM_FLOAT,
                minBufferSize.coerceAtLeast(minBufferSize * 2)
            )

            if (audioRecord.state != android.media.AudioRecord.STATE_INITIALIZED) {
                android.util.Log.e("Vocoder", "AudioRecord initialization failed")
                _vocoderState.update { it.copy(isRecording = false, error = "Error: Micrófono non dispoñible") }
                return
            }
            android.util.Log.i("Vocoder", "AudioRecord initialized, starting recording")

            audioRecord.startRecording()
            
            val readBuffer = FloatArray(2048)
            while (_vocoderState.value.isRecording && totalRead < bufferSizeSamples) {
                val read = audioRecord.read(readBuffer, 0, readBuffer.size, android.media.AudioRecord.READ_BLOCKING)
                if (read > 0) {
                    val actualToCopy = minOf(read, bufferSizeSamples - totalRead)
                    System.arraycopy(readBuffer, 0, recordBuffer, totalRead, actualToCopy)
                    totalRead += actualToCopy

                    // Calcular nivel VU en tempo real para feedback visual
                    var sumSq = 0f
                    for (i in 0 until read) {
                        sumSq += readBuffer[i] * readBuffer[i]
                    }
                    val rms = kotlin.math.sqrt(sumSq / read)
                    // Normalizar suavemente para a barra (pico arredor de 0.5-0.7 para fala normal)
                    _vocoderState.update { it.copy(vuLevel = (rms * 5f).coerceIn(0f, 1f)) }
                }
            }
            
            _vocoderState.update { it.copy(isRecording = false, vuLevel = 0f) }

            audioRecord.stop()
            audioRecord.release()

            if (totalRead > 0) {
                // Normalización de pico para o modulador
                val finalBuffer = recordBuffer.copyOfRange(0, totalRead)
                var maxVal = 0.01f
                for (v in finalBuffer) {
                    val absV = kotlin.math.abs(v)
                    if (absV > maxVal) maxVal = absV
                }
                if (maxVal < 0.9f) {
                    val scale = 0.9f / maxVal
                    for (i in finalBuffer.indices) {
                        finalBuffer[i] *= scale
                    }
                }

                audioBridge.setVocoderModulator(finalBuffer)
                _vocoderState.update { it.copy(hasModulator = true, modulatorLength = totalRead, error = null) }
            }
        } catch (e: SecurityException) {
            _vocoderState.update { it.copy(isRecording = false, error = "Error: Permiso de micrófono denegado") }
        } finally {
            _vocoderState.update { it.copy(isRecording = false) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        audioBridge.stop()
    }
}
