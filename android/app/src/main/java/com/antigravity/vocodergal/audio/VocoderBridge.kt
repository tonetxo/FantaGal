package com.antigravity.vocodergal.audio

/**
 * Clase que envuelve las llamadas JNI al motor C++.
 */
class VocoderBridge {
    init {
        System.loadLibrary("vocoder")
    }

    external fun create()
    external fun start(): Boolean
    external fun stop()
    external fun destroy()

    // Parámetros
    external fun setPitch(pitch: Float)
    external fun setIntensity(intensity: Float)
    external fun setWaveform(type: Int)
    external fun setVibrato(amount: Float)
    external fun setEcho(amount: Float)
    external fun setTremolo(amount: Float)
    external fun setNoiseThreshold(threshold: Float)
    
    // Gestión de fuente y datos
    external fun setSource(source: Int) // 0 = Mic, 1 = File
    external fun loadModulatorData(data: FloatArray)
    external fun setFilePlaying(playing: Boolean)
    external fun resetFileIndex()
    
    // Grabación Interna
    external fun startRecording()
    external fun stopRecording()

    // Visualización
    external fun getVULevel(): Float
    external fun getWaveformData(): FloatArray
}
