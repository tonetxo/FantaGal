package com.tonetxo.fantagal.audio

/**
 * SynthState - UI state for synth parameters
 *
 * All values are normalized 0.0 - 1.0
 */
data class SynthState(
    val pressure: Float = 0.5f,
    val resonance: Float = 0.5f,
    val viscosity: Float = 0.5f,
    val turbulence: Float = 0.5f,
    val diffusion: Float = 0.5f
)
