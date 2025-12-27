import { SynthState } from '../types';
import { ISynthEngine } from './BaseSynthEngine';

/**
 * Abstract base class for synth engines.
 * Provides common audio chain setup (masterGain, compressor) and lifecycle management.
 * Subclasses only need to implement engine-specific logic.
 */
export abstract class AbstractSynthEngine implements ISynthEngine {
    protected ctx: AudioContext | null = null;
    protected masterGain: GainNode | null = null;
    protected compressor: DynamicsCompressorNode | null = null;
    protected isInitialized = false;

    // Compressor settings (can be overridden by subclasses)
    protected readonly compressorThreshold = -24;
    protected readonly compressorKnee = 30;
    protected readonly compressorRatio = 12;
    protected readonly compressorAttack = 0.003;
    protected readonly compressorRelease = 0.25;

    /**
     * Initialize the engine with an AudioContext.
     * Sets up the common master chain and calls initializeEngine() for subclass-specific setup.
     */
    init(ctx: AudioContext): void {
        if (this.isInitialized) return;
        this.ctx = ctx;
        this.setupMasterChain();
        this.initializeEngine();
        this.isInitialized = true;
    }

    /**
   * Sets up the common master audio chain: masterGain -> compressor -> destination
   * Subclasses can override connectToDestination to use custom routing.
   */
    protected setupMasterChain(): void {
        if (!this.ctx) return;

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;

        // Dynamics compressor for consistent output
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = this.compressorThreshold;
        this.compressor.knee.value = this.compressorKnee;
        this.compressor.ratio.value = this.compressorRatio;
        this.compressor.attack.value = this.compressorAttack;
        this.compressor.release.value = this.compressorRelease;

        // Default connection - subclasses can override by not calling super or using custom chain
        if (this.useDefaultRouting()) {
            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.ctx.destination);
        }
    }

    /**
     * Override this to return false if your engine needs a custom audio routing.
     * When false, you must manually connect masterGain to destination in initializeEngine().
     */
    protected useDefaultRouting(): boolean {
        return true;
    }

    /**
     * Resume the audio context if suspended.
     */
    async resume(): Promise<void> {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Reinitialize the engine with a new AudioContext without losing state.
     * This is used to restore audio after Android communication mode.
     */
    reinitWithContext(ctx: AudioContext): void {
        this.ctx = ctx;
        this.setupMasterChain();
        this.onContextReinit();
    }

    /**
     * Called when context is reinitialized. Override in subclasses to reconnect audio nodes.
     * Default implementation does nothing (state is preserved, only master chain is rebuilt).
     */
    protected onContextReinit(): void {
        // Override in subclasses if specific reconnection is needed
    }

    /**
     * Get the AudioContext (for subclasses that need it)
     */
    protected getContext(): AudioContext | null {
        return this.ctx;
    }

    /**
     * Get the master gain node (for subclasses to connect their audio)
     */
    protected getMasterGain(): GainNode | null {
        return this.masterGain;
    }

    // ============ Template methods for subclasses ============

    /**
     * Called during init() after master chain is set up.
     * Subclasses should create their specific audio nodes here.
     */
    protected abstract initializeEngine(): void;

    /**
     * Update synth parameters based on state.
     */
    abstract updateParameters(state: SynthState): void;

    /**
     * Play a note at the given frequency and velocity.
     * Returns a unique ID for the note (for stopping later).
     */
    abstract playNote(frequency: number, velocity?: number): number | undefined;

    /**
     * Stop a note by its ID.
     */
    abstract stopNote(id: number): void;

    /**
     * Reset the engine to its default state when deactivated
     */
    reset?(): void; // Optional method that can be implemented by subclasses
}
