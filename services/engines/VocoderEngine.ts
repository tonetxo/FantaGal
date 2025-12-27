import { SynthState } from '../../types';
import { AbstractSynthEngine } from '../AbstractSynthEngine';
import { createReverbImpulse, createNoiseBuffer } from '../audioUtils';

/**
 * Vocoder das Covas - Cave Vocoder
 * Uses audio from other engines as carriers and microphone as modulator.
 * Features massive convolution reverb and spectral-driven particle visualization.
 */
export class VocoderEngine extends AbstractSynthEngine {
    // Vocoder bands
    private readonly NUM_BANDS = 12;
    private modulatorBands: BiquadFilterNode[] = [];
    private carrierBands: BiquadFilterNode[] = [];
    private envelopeFollowers: { analyser: AnalyserNode; gain: GainNode }[] = [];

    // Audio nodes
    private micStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private micGain: GainNode | null = null;
    private carrierGain: GainNode | null = null;
    private dryGain: GainNode | null = null;
    private wetGain: GainNode | null = null;
    private reverb: ConvolverNode | null = null;
    private outputAnalyser: AnalyserNode | null = null;

    // Internal carrier sources
    private internalNoise: AudioBufferSourceNode | null = null;
    private internalOscillators: OscillatorNode[] = [];
    private internalCarrierGain: GainNode | null = null;

    // External carrier taps (from other engines) - TODO: implement
    private criosferaTap: GainNode | null = null;
    private gearheartTap: GainNode | null = null;

    // State
    private isMicActive: boolean = false;
    private carrierBalance: number = 0.5; // 0 = all Criosfera, 1 = all Gearheart
    private envelopeAnimationId: number | null = null; // For cancelling animation loop

    protected useDefaultRouting(): boolean {
        return false; // Custom routing
    }

    protected initializeEngine(): void {
        const ctx = this.getContext();
        const masterGain = this.getMasterGain();
        if (!ctx || !masterGain) return;

        masterGain.gain.value = 0.7;

        // Create gain nodes
        this.micGain = ctx.createGain();
        this.micGain.gain.value = 8.0; // Higher gain for more sensitive microphone input

        this.carrierGain = ctx.createGain();
        this.carrierGain.gain.value = 1.0;

        this.internalCarrierGain = ctx.createGain();
        this.internalCarrierGain.gain.value = 0.1; // Reduced further to balance with microphone

        this.dryGain = ctx.createGain();
        this.dryGain.gain.value = 0.1; // Low dry for clear vocoder effect

        this.wetGain = ctx.createGain();
        this.wetGain.gain.value = 0.9; // High wet for strong effect

        // Create massive reverb (the "caves")
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = createReverbImpulse(ctx, 8, 3); // Long, dense reverb

        // Output analyser for visualization
        this.outputAnalyser = ctx.createAnalyser();
        this.outputAnalyser.fftSize = 2048;
        this.outputAnalyser.smoothingTimeConstant = 0.8;

        // Don't create carrier here - it will be created when mic is enabled

        // Create vocoder bands
        this.createVocoderBands();

        // Audio routing:
        // Internal Carrier -> Vocoder Carrier Bands -> Controlled by Mic Envelope -> Output
        // Mic -> Vocoder Modulator Bands -> Envelope Followers -> Control Carrier Band Gains
        // Vocoder Output -> Dry/Wet Split -> Reverb -> Master

        // Connect wet path through reverb
        this.wetGain.connect(this.reverb);
        this.reverb.connect(masterGain);

        // Connect dry path
        this.dryGain.connect(masterGain);

        // Connect master to analyser and compressor
        masterGain.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.compressor!);
        this.compressor!.connect(ctx.destination);
    }

    private createInternalCarrier(): void {
        const ctx = this.getContext();
        if (!ctx || !this.internalCarrierGain) return;

        // Create white noise buffer using shared utility
        const noiseBuffer = createNoiseBuffer(ctx, 2);

        // Noise source - create fresh each time
        this.internalNoise = ctx.createBufferSource();
        this.internalNoise.buffer = noiseBuffer;
        this.internalNoise.loop = true;
        this.internalNoise.connect(this.internalCarrierGain);
        this.internalNoise.start();

        // Add harmonic oscillators for tonal content
        const harmonics = [110, 220, 330, 440]; // A2 and harmonics
        this.internalOscillators = []; // Clear any old references
        harmonics.forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.value = 0.3 / harmonics.length; // Increased gain for more tonal content
            osc.connect(gain);
            gain.connect(this.internalCarrierGain!);
            osc.start();
            this.internalOscillators.push(osc);
        });
    }

    private stopInternalCarrier(): void {
        // Stop and disconnect noise
        if (this.internalNoise) {
            try {
                this.internalNoise.stop();
                this.internalNoise.disconnect();
            } catch (e) {
                // Already stopped
            }
            this.internalNoise = null;
        }

        // Stop and disconnect oscillators
        this.internalOscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            } catch (e) {
                // Already stopped
            }
        });
        this.internalOscillators = [];
    }

    private createVocoderBands(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        // Create logarithmic frequency bands (20Hz - 20kHz)
        const minFreq = 100;
        const maxFreq = 10000;
        const ratio = Math.pow(maxFreq / minFreq, 1 / this.NUM_BANDS);

        for (let i = 0; i < this.NUM_BANDS; i++) {
            const freq = minFreq * Math.pow(ratio, i);
            const bandwidth = freq * 0.4; // 40% bandwidth

            // Modulator band (analyzes mic input) - separate path for envelope detection
            const modFilter = ctx.createBiquadFilter();
            modFilter.type = 'bandpass';
            modFilter.frequency.value = freq;
            modFilter.Q.value = freq / bandwidth;
            this.modulatorBands.push(modFilter);

            // Envelope follower (extracts amplitude from modulator) - separate analyser
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.85; // Smooth envelope
            modFilter.connect(analyser);

            // Carrier band (filters carrier signal)
            const carrierFilter = ctx.createBiquadFilter();
            carrierFilter.type = 'bandpass';
            carrierFilter.frequency.value = freq;
            carrierFilter.Q.value = freq / bandwidth;
            this.carrierBands.push(carrierFilter);

            // Gain controlled by envelope
            const bandGain = ctx.createGain();
            bandGain.gain.value = 0;
            carrierFilter.connect(bandGain);

            // Output to wet/dry
            bandGain.connect(this.wetGain!);
            bandGain.connect(this.dryGain!);

            this.envelopeFollowers.push({ analyser, gain: bandGain });
        }

        // Connect internal carrier to all carrier bands
        if (this.internalCarrierGain) {
            this.carrierBands.forEach(band => {
                this.internalCarrierGain!.connect(band);
            });
        }

        // Start envelope following loop
        this.startEnvelopeFollowing();
    }

    private startEnvelopeFollowing(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const update = () => {
            // Update gain for each band based on modulator amplitude
            this.envelopeFollowers.forEach(({ analyser, gain }, index) => {
                if (!this.isMicActive) {
                    // When mic is off, silence the output
                    gain.gain.setTargetAtTime(0, ctx!.currentTime, 0.05);
                    return;
                }

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteTimeDomainData(dataArray);

                // Calculate RMS amplitude
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const normalized = (dataArray[i] - 128) / 128;
                    sum += normalized * normalized;
                }
                const rms = Math.sqrt(sum / dataArray.length);

                // Apply to carrier band gain - adjusted for better response
                // Use a more sensitive scaling for microphone input
                const minGain = 0.01; // Lower floor to allow more subtle modulation
                const modulatedGain = Math.max(minGain, rms * 50); // Increased multiplier for stronger effect
                gain.gain.setTargetAtTime(modulatedGain, ctx!.currentTime, 0.01); // Use setTargetAtTime with small time constant to avoid clicks
            });

            this.envelopeAnimationId = requestAnimationFrame(update);
        };

        update();
    }

    /**
     * Connect carrier sources (Criosfera and Gearheart engines)
     */
    public setCarrierSources(criosferaTap: GainNode | null, gearheartTap: GainNode | null): void {
        const ctx = this.getContext();
        if (!ctx) return;

        // Disconnect old taps from ALL carrier bands
        if (this.criosferaTap) {
            try {
                this.carrierBands.forEach(band => {
                    this.criosferaTap!.disconnect(band);
                });
            } catch (e) {
                // Ignore if already disconnected
            }
        }
        if (this.gearheartTap) {
            try {
                this.carrierBands.forEach(band => {
                    this.gearheartTap!.disconnect(band);
                });
            } catch (e) {
                // Ignore if already disconnected
            }
        }

        this.criosferaTap = criosferaTap;
        this.gearheartTap = gearheartTap;

        // Connect external carriers to EACH carrier band
        // This is critical - each band must receive the carrier signal
        if (criosferaTap) {
            this.carrierBands.forEach(band => {
                criosferaTap.connect(band);
            });
        }

        if (gearheartTap) {
            this.carrierBands.forEach(band => {
                gearheartTap.connect(band);
            });
        }

        // Update carrier balance
        this.updateCarrierBalance();
    }

    private updateCarrierBalance(): void {
        if (!this.internalCarrierGain) {
            console.warn('[Vocoder] updateCarrierBalance called but internalCarrierGain is null');
            return;
        }

        // carrierBalance comes from viscosity parameter (0-1)
        // 0 = internal only, 1 = external only
        const externalWeight = this.carrierBalance;
        const internalWeight = 1.0 - externalWeight;

        // At 100% viscosity, internal should be completely silent
        // Scale internal by 0.05 max, but at viscosity=1.0 it should be 0
        const internalGain = internalWeight * 0.05;

        const ctx = this.getContext();
        if (!ctx) return;

        this.internalCarrierGain.gain.setTargetAtTime(internalGain, ctx.currentTime, 0.1);
    }

    /**
     * Enable/disable microphone input
     */
    public async setMicEnabled(enabled: boolean): Promise<void> {
        const ctx = this.getContext();
        if (!ctx || !this.micGain) return;

        if (enabled) {
            // Request microphone access
            if (!this.micStream) {
                try {
                    this.micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    });
                } catch (err) {
                    console.error('[Vocoder] Error accessing microphone:', err);
                    return;
                }
            }

            // Connect microphone
            if (!this.micSource) {
                this.micSource = ctx.createMediaStreamSource(this.micStream);
                this.micSource.connect(this.micGain);

                // Connect mic to all modulator bands
                this.modulatorBands.forEach(band => {
                    this.micGain!.connect(band);
                });
            }

            this.micStream.getAudioTracks().forEach(track => track.enabled = true);

            // Start carrier (recreate to ensure fresh sources)
            this.stopInternalCarrier();
            this.createInternalCarrier();

            this.isMicActive = true;
        } else {
            // Stop carrier
            this.stopInternalCarrier();

            // Stop and disconnect microphone
            if (this.micStream) {
                this.micStream.getAudioTracks().forEach(track => {
                    track.stop();
                });
            }
            if (this.micSource) {
                this.micSource.disconnect();
                this.micSource = null;
            }
            this.micStream = null;
            this.isMicActive = false;
        }
    }

    updateParameters(state: SynthState): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const t = ctx.currentTime;

        // Pressure -> Dry/Wet mix
        const wet = state.pressure;
        this.wetGain?.gain.setTargetAtTime(wet, t, 0.1);
        this.dryGain?.gain.setTargetAtTime(1 - wet, t, 0.1);

        // Resonance -> Band resonance (Q value)
        const q = 1 + state.resonance * 10;
        this.carrierBands.forEach(band => {
            const freq = band.frequency.value;
            band.Q.setTargetAtTime(q, t, 0.1);
        });
        this.modulatorBands.forEach(band => {
            const freq = band.frequency.value;
            band.Q.setTargetAtTime(q, t, 0.1);
        });

        // Viscosity -> Carrier balance (Criosfera ↔ Gearheart)
        this.carrierBalance = state.viscosity;

        // Turbulence -> Formant shift (shift all band frequencies)
        const shift = 1 + (state.turbulence - 0.5) * 0.5; // ±25%
        this.carrierBands.forEach((band, i) => {
            const baseFreq = 100 * Math.pow(100, i / this.NUM_BANDS);
            band.frequency.setTargetAtTime(baseFreq * shift, t, 0.1);
        });
        this.modulatorBands.forEach((band, i) => {
            const baseFreq = 100 * Math.pow(100, i / this.NUM_BANDS);
            band.frequency.setTargetAtTime(baseFreq * shift, t, 0.1);
        });

        // Diffusion -> Reverb mix (via master gain to reverb)
        // This is tricky - we need to adjust the reverb contribution
        // For now, diffusion affects the overall wetness

        // Update carrier balance when viscosity changes
        this.updateCarrierBalance();
    }

    playNote(frequency: number, velocity?: number): number | undefined {
        // Not used for vocoder
        return undefined;
    }

    stopNote(id: number): void {
        // Not used for vocoder
    }

    // Accessors for UI
    public getIsMicActive(): boolean {
        return this.isMicActive;
    }

    public getOutputAnalyser(): AnalyserNode | null {
        return this.outputAnalyser;
    }

    public getBandAnalysers(): AnalyserNode[] {
        return this.envelopeFollowers.map(ef => ef.analyser);
    }

    /**
     * Reset the engine to its default state when deactivated
     */
    public reset(): void {
        // Stop and disconnect mic if active
        if (this.isMicActive) {
            this.setMicEnabled(false);
        }

        // Cancel envelope following animation loop
        if (this.envelopeAnimationId !== null) {
            cancelAnimationFrame(this.envelopeAnimationId);
            this.envelopeAnimationId = null;
        }

        // Disconnect from external carrier sources
        this.setCarrierSources(null, null);
    }
}
