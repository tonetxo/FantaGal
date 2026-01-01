#pragma once

/**
 * SynthState - Shared state structure between Kotlin and C++
 * Mirrors the TypeScript SynthState interface
 */
struct SynthState {
    float pressure = 0.5f;      // Overall intensity/pressure
    float resonance = 0.5f;     // Filter resonance/feedback
    float viscosity = 0.5f;     // Fluid density (affects attack/release)
    float turbulence = 0.5f;    // Modulation depth (LFO intensity)
    float diffusion = 0.5f;     // Reverb/space mix
};
