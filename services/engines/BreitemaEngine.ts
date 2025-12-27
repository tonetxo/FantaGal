import { SynthState } from '../../types';
import { AbstractSynthEngine } from '../AbstractSynthEngine';
import { createReverbImpulse } from '../audioUtils';

/**
 * Brétema Grid - Generative Step Sequencer
 * Probabilistic sequencer with FM synthesis, lo-fi aesthetics, and Galician rhythmic modes.
 */
export class BreitemaEngine extends AbstractSynthEngine {
    // Sequencer state
    private readonly NUM_STEPS = 16;
    private steps: boolean[] = new Array(16).fill(false);
    private stepProbabilities: number[] = new Array(16).fill(0.5);
    private currentStep = 0;
    private isPlaying = false;
    private schedulerTimerId: number | null = null;

    // Tempo and timing
    private tempo = 120; // BPM
    private nextStepTime = 0;
    private readonly SCHEDULE_AHEAD_TIME = 0.1;
    private readonly LOOK_AHEAD_MS = 25;

    // Rhythm modes: 'libre' | 'muineira' | 'ribeirada'
    private rhythmMode: 'libre' | 'muineira' | 'ribeirada' = 'libre';

    // FM Synthesis
    private carrier: OscillatorNode | null = null;
    private modulator: OscillatorNode | null = null;
    private modulatorGain: GainNode | null = null;
    private fmDepth = 100;
    private baseFrequency = 110; // A2

    // Effects chain
    private filter: BiquadFilterNode | null = null;
    private bitcrusher: AudioWorkletNode | null = null;
    private reverb: ConvolverNode | null = null;
    private reverbGain: GainNode | null = null;
    private dryGain: GainNode | null = null;

    // Niebla (fog) modulation
    private fogDensity = 0.5;
    private fogMovement = 0.2;
    private fogLfo: OscillatorNode | null = null;
    private fogLfoGain: GainNode | null = null;

    // Note frequencies for melodic mode
    private readonly SCALE_NOTES = [
        110.00, // A2
        123.47, // B2
        130.81, // C3
        146.83, // D3
        164.81, // E3
        174.61, // F3
        196.00, // G3
        220.00  // A3
    ];

    // Muiñeira pattern (6/8): accents on 1, 4
    private readonly MUINEIRA_PATTERN = [1.0, 0.6, 0.4, 0.9, 0.5, 0.3, 0.8, 0.4, 0.3, 0.9, 0.5, 0.4, 0.7, 0.4, 0.3, 0.2];
    // Ribeirada pattern: syncopated 
    private readonly RIBEIRADA_PATTERN = [1.0, 0.3, 0.7, 0.4, 0.9, 0.3, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.4, 0.9, 0.3, 0.5];

    protected useDefaultRouting(): boolean {
        return false;
    }

    protected initializeEngine(): void {
        const ctx = this.getContext();
        const masterGain = this.getMasterGain();
        if (!ctx || !masterGain) return;

        masterGain.gain.value = 0.6;

        // Filter
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 800;
        this.filter.Q.value = 4;

        // Reverb
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = createReverbImpulse(ctx, 4, 3);

        this.reverbGain = ctx.createGain();
        this.reverbGain.gain.value = 0.3;

        this.dryGain = ctx.createGain();
        this.dryGain.gain.value = 0.7;

        // Fog LFO (modulates step probabilities)
        this.fogLfo = ctx.createOscillator();
        this.fogLfo.type = 'sine';
        this.fogLfo.frequency.value = 0.1;
        this.fogLfoGain = ctx.createGain();
        this.fogLfoGain.gain.value = 0.3;
        this.fogLfo.connect(this.fogLfoGain);
        this.fogLfo.start();

        // Routing: filter -> [dry + reverb] -> compressor -> destination
        this.filter.connect(this.dryGain);
        this.filter.connect(this.reverb);
        this.reverb.connect(this.reverbGain);

        this.dryGain.connect(masterGain);
        this.reverbGain.connect(masterGain);

        masterGain.connect(this.compressor!);
        this.compressor!.connect(ctx.destination);

        // Initialize random step pattern
        this.generateRandomPattern();
    }

    /**
     * Generate a random step pattern based on rhythm mode
     */
    generateRandomPattern(): void {
        const pattern = this.rhythmMode === 'muineira' ? this.MUINEIRA_PATTERN :
            this.rhythmMode === 'ribeirada' ? this.RIBEIRADA_PATTERN :
                null;

        for (let i = 0; i < this.NUM_STEPS; i++) {
            if (pattern) {
                this.stepProbabilities[i] = pattern[i];
                this.steps[i] = pattern[i] > 0.5;
            } else {
                this.stepProbabilities[i] = Math.random();
                this.steps[i] = Math.random() > 0.5;
            }
        }
    }

    /**
     * Start the sequencer
     */
    startSequencer(): void {
        if (this.isPlaying) return;

        const ctx = this.getContext();
        if (!ctx) return;

        this.isPlaying = true;
        this.currentStep = 0;
        this.nextStepTime = ctx.currentTime;

        this.scheduler();
    }

    /**
     * Stop the sequencer
     */
    stopSequencer(): void {
        this.isPlaying = false;
        if (this.schedulerTimerId) {
            clearTimeout(this.schedulerTimerId);
            this.schedulerTimerId = null;
        }
    }

    /**
     * Main scheduler loop
     */
    private scheduler(): void {
        const ctx = this.getContext();
        if (!ctx || !this.isPlaying) return;

        while (this.nextStepTime < ctx.currentTime + this.SCHEDULE_AHEAD_TIME) {
            this.scheduleStep(this.currentStep, this.nextStepTime);
            this.advanceStep();
        }

        this.schedulerTimerId = window.setTimeout(() => this.scheduler(), this.LOOK_AHEAD_MS);
    }

    /**
     * Schedule a single step
     */
    private scheduleStep(step: number, time: number): void {
        const ctx = this.getContext();
        if (!ctx || !this.filter) return;

        // Calculate probability with fog modulation
        let prob = this.stepProbabilities[step] * this.fogDensity;
        prob += (Math.sin(time * this.fogMovement * Math.PI) * 0.2);
        prob = Math.max(0, Math.min(1, prob));

        // Probabilistic trigger
        if (this.steps[step] && Math.random() < prob) {
            this.playFMNote(time, step);
        }
    }

    /**
     * Play an FM note
     */
    private playFMNote(time: number, step: number): void {
        const ctx = this.getContext();
        if (!ctx || !this.filter) return;

        // Select note based on step (creates melodic pattern)
        const noteIndex = step % this.SCALE_NOTES.length;
        const frequency = this.SCALE_NOTES[noteIndex];

        // Create FM pair
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modulatorGain = ctx.createGain();
        const noteGain = ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.value = frequency;

        modulator.type = 'sine';
        modulator.frequency.value = frequency * 2; // Harmonic ratio
        modulatorGain.gain.value = this.fmDepth;

        // FM connection
        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);

        // Output
        carrier.connect(noteGain);
        noteGain.connect(this.filter);

        // Envelope
        const duration = 60 / this.tempo / 2; // Half step duration
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(0.4, time + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        // Filter envelope
        this.filter.frequency.setValueAtTime(2000, time);
        this.filter.frequency.exponentialRampToValueAtTime(400, time + duration);

        // Start and stop
        carrier.start(time);
        modulator.start(time);
        carrier.stop(time + duration + 0.1);
        modulator.stop(time + duration + 0.1);
    }

    /**
     * Advance to next step
     */
    private advanceStep(): void {
        const stepsPerBeat = this.rhythmMode === 'muineira' ? 3 : 4;
        const secondsPerStep = 60 / this.tempo / stepsPerBeat;

        this.nextStepTime += secondsPerStep;
        this.currentStep = (this.currentStep + 1) % this.NUM_STEPS;
    }

    /**
     * Toggle a step on/off
     */
    toggleStep(step: number): void {
        if (step >= 0 && step < this.NUM_STEPS) {
            this.steps[step] = !this.steps[step];
        }
    }

    /**
     * Set rhythm mode
     */
    setRhythmMode(mode: 'libre' | 'muineira' | 'ribeirada'): void {
        this.rhythmMode = mode;
        this.generateRandomPattern();
    }

    /**
     * Get current sequencer state for UI
     */
    getSequencerState(): { steps: boolean[], currentStep: number, probabilities: number[] } {
        return {
            steps: [...this.steps],
            currentStep: this.currentStep,
            probabilities: [...this.stepProbabilities]
        };
    }

    getRhythmMode(): string {
        return this.rhythmMode;
    }

    isSequencerPlaying(): boolean {
        return this.isPlaying;
    }

    updateParameters(state: SynthState): void {
        const ctx = this.getContext();
        if (!ctx) return;
        const t = ctx.currentTime;

        // Pressure -> Tempo (60-180 BPM)
        this.tempo = 60 + (state.pressure * 120);

        // Resonance -> FM depth
        this.fmDepth = state.resonance * 500;

        // Viscosity -> Fog density (probability multiplier)
        this.fogDensity = 0.2 + (state.viscosity * 0.8);

        // Turbulence -> Fog movement (LFO speed)
        this.fogMovement = state.turbulence * 2;
        this.fogLfo?.frequency.setTargetAtTime(0.05 + state.turbulence * 0.5, t, 0.1);

        // Diffusion -> Reverb mix
        this.reverbGain?.gain.setTargetAtTime(state.diffusion * 0.6, t, 0.1);
        this.dryGain?.gain.setTargetAtTime(1 - state.diffusion * 0.4, t, 0.1);

        // Filter resonance
        this.filter?.Q.setTargetAtTime(1 + state.resonance * 10, t, 0.1);
    }

    playNote(frequency: number, velocity?: number): number | undefined {
        // Not used - sequencer handles notes internally
        return undefined;
    }

    stopNote(id: number): void {
        // Not used
    }

    reset(): void {
        this.stopSequencer();
    }
}
