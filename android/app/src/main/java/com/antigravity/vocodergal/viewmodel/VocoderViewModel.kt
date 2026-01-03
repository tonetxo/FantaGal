package com.antigravity.vocodergal.viewmodel

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.antigravity.vocodergal.audio.VocoderBridge
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * ViewModel que gestiona el estado del vocoder y la comunicación con el motor C++.
 */
class VocoderViewModel : ViewModel() {
    
    companion object {
        private const val TAG = "VocoderViewModel"
        private const val TARGET_SAMPLE_RATE = 48000
    }
    
    private val bridge = VocoderBridge()
    private var hasPermission = false
    
    // Estado de la UI
    private val _isRunning = MutableStateFlow(false)
    val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()
    
    private val _vuLevel = MutableStateFlow(0f)
    val vuLevel: StateFlow<Float> = _vuLevel.asStateFlow()
    
    private val _waveformData = MutableStateFlow(FloatArray(256))
    val waveformData: StateFlow<FloatArray> = _waveformData.asStateFlow()
    
    // Parámetros
    private val _pitch = MutableStateFlow(140f)
    val pitch: StateFlow<Float> = _pitch.asStateFlow()
    
    private val _intensity = MutableStateFlow(0.6f)
    val intensity: StateFlow<Float> = _intensity.asStateFlow()
    
    private val _waveform = MutableStateFlow(0) // 0=Saw, 1=Square, 2=Tri, 3=Sine
    val waveform: StateFlow<Int> = _waveform.asStateFlow()
    
    private val _vibrato = MutableStateFlow(0f)
    val vibrato: StateFlow<Float> = _vibrato.asStateFlow()
    
    private val _echo = MutableStateFlow(0f)
    val echo: StateFlow<Float> = _echo.asStateFlow()
    
    // Selección del pad XY (en galego)
    private val _selectedXParam = MutableStateFlow("ton")
    val selectedXParam: StateFlow<String> = _selectedXParam.asStateFlow()
    
    private val _selectedYParam = MutableStateFlow("intensidade")
    val selectedYParam: StateFlow<String> = _selectedYParam.asStateFlow()
    
    // Fuente
    private val _isMicSource = MutableStateFlow(true)
    val isMicSource: StateFlow<Boolean> = _isMicSource.asStateFlow()

    private val _isFilePlaying = MutableStateFlow(false)
    val isFilePlaying: StateFlow<Boolean> = _isFilePlaying.asStateFlow()

    private val _isDecoding = MutableStateFlow(false)
    val isDecoding: StateFlow<Boolean> = _isDecoding.asStateFlow()

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    private var audioRecord: android.media.AudioRecord? = null
    private var recordingJob: kotlinx.coroutines.Job? = null

    private val _tremolo = MutableStateFlow(0f)
    val tremolo: StateFlow<Float> = _tremolo.asStateFlow()

    init {
        Log.d(TAG, "ViewModel init - creating bridge")
        bridge.create()
        startUIUpdates()
    }
    
    fun onPermissionGranted() {
        Log.d(TAG, "Permission granted")
        hasPermission = true
    }
    
    private fun startUIUpdates() {
        viewModelScope.launch {
            while (true) {
                if (_isRunning.value) {
                    _vuLevel.value = bridge.getVULevel()
                    _waveformData.value = bridge.getWaveformData()
                }
                delay(16) // ~60 FPS
            }
        }
    }
    
    fun togglePower() {
        if (_isRunning.value) {
            bridge.stop()
            _isRunning.value = false
        } else {
            if (_isMicSource.value && !hasPermission) return
            if (bridge.start()) {
                _isRunning.value = true
            }
        }
    }
    
    fun toggleSource() {
        _isMicSource.value = !_isMicSource.value
        bridge.setSource(if (_isMicSource.value) 0 else 1)
    }

    fun toggleFilePlayback() {
        _isFilePlaying.value = !_isFilePlaying.value
        bridge.setFilePlaying(_isFilePlaying.value)
    }

    fun resetFilePlayback() {
        bridge.resetFileIndex()
    }

    fun toggleRecording() {
        if (_isRecording.value) {
            stopRecording()
        } else {
            if (!hasPermission) return
            startRecording()
        }
    }

    private fun startRecording() {
        Log.d(TAG, "Starting internal recording in C++ engine")
        // Asegurar que el motor esté encendido para poder grabar
        if (!_isRunning.value) {
            if (bridge.start()) {
                _isRunning.value = true
            } else {
                Log.e(TAG, "Could not start engine for recording")
                return
            }
        }
        
        _isRecording.value = true
        bridge.startRecording()
    }

    private fun stopRecording() {
        Log.d(TAG, "Stopping internal recording in C++ engine")
        _isRecording.value = false
        bridge.stopRecording()
        
        // Al terminar, la grabación se carga automáticamente en el engine como "File"
        _isMicSource.value = false
        _isFilePlaying.value = true
        bridge.setSource(1)
        bridge.setFilePlaying(true)
    }

    fun loadAudioFile(context: Context, uri: Uri) {
        viewModelScope.launch {
            _isDecoding.value = true
            try {
                val data = decodeAudioFile(context, uri)
                if (data != null) {
                    // Normalizar el audio para que tenga niveles coherentes (pico a 0.9)
                    val maxAbs = data.maxOfOrNull { Math.abs(it) } ?: 0f
                    if (maxAbs > 0) {
                        val factor = 0.9f / maxAbs
                        for (i in data.indices) {
                            data[i] *= factor
                        }
                    }
                    
                    bridge.loadModulatorData(data)
                    _isMicSource.value = false
                    bridge.setSource(1)
                    _isFilePlaying.value = true
                    bridge.setFilePlaying(true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error decoding audio file: ${e.message}")
            } finally {
                _isDecoding.value = false
            }
        }
    }

    private suspend fun decodeAudioFile(context: Context, uri: Uri): FloatArray? = withContext(Dispatchers.IO) {
        val extractor = MediaExtractor()
        try {
            context.contentResolver.openFileDescriptor(uri, "r")?.use { fd ->
                extractor.setDataSource(fd.fileDescriptor)
            }
        } catch (e: Exception) {
            return@withContext null
        }

        var trackIndex = -1
        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.startsWith("audio/")) {
                trackIndex = i
                break
            }
        }

        if (trackIndex < 0) return@withContext null

        extractor.selectTrack(trackIndex)
        val format = extractor.getTrackFormat(trackIndex)
        val fileSampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        
        val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
        codec.configure(format, null, null, 0)
        codec.start()

        val outputSamples = mutableListOf<Float>()
        val info = MediaCodec.BufferInfo()
        var sawInputEOS = false
        var sawOutputEOS = false

        while (!sawOutputEOS) {
            if (!sawInputEOS) {
                val inputBufferIndex = codec.dequeueInputBuffer(10000)
                if (inputBufferIndex >= 0) {
                    val inputBuffer = codec.getInputBuffer(inputBufferIndex)!!
                    val sampleSize = extractor.readSampleData(inputBuffer, 0)
                    if (sampleSize < 0) {
                        codec.queueInputBuffer(inputBufferIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        sawInputEOS = true
                    } else {
                        codec.queueInputBuffer(inputBufferIndex, 0, sampleSize, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }

            val res = codec.dequeueOutputBuffer(info, 10000)
            if (res >= 0) {
                val outputBuffer = codec.getOutputBuffer(res)!!
                val pcmData = ShortArray(info.size / 2)
                outputBuffer.asShortBuffer().get(pcmData)

                for (sample in pcmData) {
                    outputSamples.add(sample.toFloat() / 32768.0f)
                }

                codec.releaseOutputBuffer(res, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    sawOutputEOS = true
                }
            }
        }

        codec.stop()
        codec.release()
        extractor.release()

        val rawData = outputSamples.toFloatArray()
        
        // Remuestreo simple lineal si la frecuencia no es 48000
        return@withContext if (fileSampleRate != TARGET_SAMPLE_RATE) {
            resample(rawData, fileSampleRate, TARGET_SAMPLE_RATE)
        } else {
            rawData
        }
    }

    private fun resample(input: FloatArray, fromRate: Int, toRate: Int): FloatArray {
        val ratio = fromRate.toDouble() / toRate.toDouble()
        val newSize = (input.size / ratio).toInt()
        val output = FloatArray(newSize)
        
        for (i in 0 until newSize) {
            val sourceIndex = i * ratio
            val index1 = sourceIndex.toInt()
            val index2 = (index1 + 1).coerceAtMost(input.size - 1)
            val frac = sourceIndex - index1
            
            output[i] = (input[index1] * (1.0 - frac) + input[index2] * frac).toFloat()
        }
        return output
    }

    fun updatePad(x: Float, y: Float) {
        updateParam(_selectedXParam.value, x)
        updateParam(_selectedYParam.value, 1f - y)
    }
    
    private fun updateParam(param: String, value: Float) {
        when (param) {
            "ton" -> {
                val p = 50f + value * 350f
                _pitch.value = p
                bridge.setPitch(p)
            }
            "intensidade" -> {
                val i = 0.2f + value * 2.8f
                _intensity.value = i
                bridge.setIntensity(i)
            }
            "vibrato" -> {
                _vibrato.value = value
                bridge.setVibrato(value)
            }
            "eco" -> {
                val e = value * 0.7f
                _echo.value = e
                bridge.setEcho(e)
            }
            "trémolo" -> {
                _tremolo.value = value
                bridge.setTremolo(value)
            }
        }
    }
    
    fun resetParams() {
        // Reset de efectos secundarios a cero
        _vibrato.value = 0f
        _echo.value = 0f
        _tremolo.value = 0f
        bridge.setVibrato(0f)
        bridge.setEcho(0f)
        bridge.setTremolo(0f)

        // Reset del Pad ao centro (0.5, 0.5)
        // Isto sincroniza automaticamente os parámetros actuais en X e Y
        updatePad(0.5f, 0.5f)
        
        Log.d(TAG, "Parámetros reiniciados e sincronizados co Pad")
    }
    
    fun setWaveform(type: Int) {
        _waveform.value = type
        bridge.setWaveform(type)
    }
    
    fun setXParam(param: String) {
        _selectedXParam.value = param
    }
    
    fun setYParam(param: String) {
        _selectedYParam.value = param
    }
    
    override fun onCleared() {
        super.onCleared()
        bridge.stop()
        bridge.destroy()
    }
}
