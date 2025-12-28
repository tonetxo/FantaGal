import { SynthState } from '../../types';
import { AbstractSynthEngine } from '../AbstractSynthEngine';
import { createReverbImpulse, createNoiseBuffer, normalizeBuffer } from '../audioUtils';

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
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private recordedBuffer: AudioBuffer | null = null;
    private bufferSource: AudioBufferSourceNode | null = null;

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
    private isRecording: boolean = false;
    private isPlayingBuffer: boolean = false;
    private carrierBalance: number = 0.5; // 0 = all Criosfera, 1 = all Gearheart
    private envelopeAnimationId: number | null = null; // For cancelling animation loop

    protected useDefaultRouting(): boolean {
        return false; // Custom routing
    }

    protected initializeEngine(): void {
        const ctx = this.getContext();
        const masterGain = this.getMasterGain();
        if (!ctx || !masterGain) return;

        masterGain.gain.value = 1.5; // Increased for vocoder audibility

        // Create gain nodes
        this.micGain = ctx.createGain();
        this.micGain.gain.value = 3.0; // Increased to make voice input more prominent

        this.carrierGain = ctx.createGain();
        this.carrierGain.gain.value = 1.0;

        this.internalCarrierGain = ctx.createGain();
        this.internalCarrierGain.gain.value = 0.3; // Reduced to prevent overpowering modulation

        this.dryGain = ctx.createGain();
        this.dryGain.gain.value = 1.5; // Adjusted for better balance

        this.wetGain = ctx.createGain();
        this.wetGain.gain.value = 1.5; // Adjusted for better balance

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

        // Connect micGain (modulator input) to all modulator bands for envelope detection
        this.modulatorBands.forEach(band => {
            this.micGain!.connect(band);
        });

        // Also connect micGain to the output for direct monitoring if needed
        this.micGain!.connect(this.dryGain!);

        // Audio routing:
        // Internal Carrier -> Vocoder Carrier Bands -> Controlled by Mic Envelope -> Output
        // Mic -> Vocoder Modulator Bands -> Envelope Followers -> Control Carrier Band Gains
        // Vocoder Output -> Dry/Wet Split -> Reverb -> Master

        // Connect wet path through reverb
        this.wetGain.connect(this.reverb);
        this.reverb.connect(masterGain);

        // Connect dry path
        this.dryGain.connect(masterGain);

        // Connect master to analyser and then to masterBus (no internal compressor)
        masterGain.connect(this.outputAnalyser);
        if (this.masterBus) {
            this.outputAnalyser.connect(this.masterBus);
        } else {
            this.outputAnalyser.connect(ctx.destination);
        }
    }

    private createInternalCarrier(): void {
        const ctx = this.getContext();
        if (!ctx || !this.internalCarrierGain) return;

        // Create white noise buffer using shared utility - longer for smoother loop
        const noiseBuffer = createNoiseBuffer(ctx, 4); // 4 seconds for smoother loop

        // Noise source - create fresh each time
        this.internalNoise = ctx.createBufferSource();
        this.internalNoise.buffer = noiseBuffer;
        this.internalNoise.loop = true;
        this.internalNoise.connect(this.internalCarrierGain);
        this.internalNoise.start();

        // Add harmonic oscillators for tonal content - more appropriate for speech
        const harmonics = [100, 200, 300, 400, 500, 600]; // Richer harmonic content
        this.internalOscillators = []; // Clear any old references
        harmonics.forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth'; // Sawtooth has richer harmonics for vocoding
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.value = 0.15 / harmonics.length; // Slightly reduced to balance with noise
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

        // Create frequency bands optimized for human speech (formant frequencies)
        // Standard formant frequencies: F1 (~200-1000Hz), F2 (~800-2500Hz), F3 (~2000-4000Hz)
        const minFreq = 80;   // Lower for better bass response
        const maxFreq = 8000; // Higher frequencies for sibilance
        const ratio = Math.pow(maxFreq / minFreq, 1 / this.NUM_BANDS);

        for (let i = 0; i < this.NUM_BANDS; i++) {
            const freq = minFreq * Math.pow(ratio, i);
            const bandwidth = freq * 1.0; // Tighter bandwidth for cleaner spectral separation

            // Modulator band (analyzes mic input) - separate path for envelope detection
            const modFilter = ctx.createBiquadFilter();
            modFilter.type = 'bandpass';
            modFilter.frequency.value = freq;
            modFilter.Q.value = freq / bandwidth;
            this.modulatorBands.push(modFilter);

            // Envelope follower (extracts amplitude from modulator) - separate analyser
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.85; // Slightly less smooth for better voice tracking
            modFilter.connect(analyser);

            // Carrier band (filters carrier signal)
            const carrierFilter = ctx.createBiquadFilter();
            carrierFilter.type = 'bandpass';
            carrierFilter.frequency.value = freq;
            carrierFilter.Q.value = freq / bandwidth;
            this.carrierBands.push(carrierFilter);

            // Gain controlled by envelope - start with 0 gain when no modulation
            const bandGain = ctx.createGain();
            bandGain.gain.value = 0.01; // Small initial gain to prevent complete silence
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

        let logCounter = 0;
        const update = () => {
            // Update gain for each band based on modulator amplitude
            let totalRms = 0;
            this.envelopeFollowers.forEach(({ analyser, gain }, index) => {
                if (!this.isPlayingBuffer) {
                    // When not playing buffer, silence the output
                    gain.gain.setTargetAtTime(0.01, ctx!.currentTime, 0.05); // Keep minimal gain to prevent clicks
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
                totalRms += rms;

                // Apply to carrier band gain - adjusted for better voice intelligibility
                // Use more sensitive scaling to make modulation more audible
                const minGain = 0.01; // Small minimum to prevent complete silence

                // Noise gate to prevent background hiss from opening bands
                let effectiveRms = rms;
                if (effectiveRms < 0.02) effectiveRms = 0.01; // Lower gate threshold for more sensitivity

                // Multiplier adjusted for better voice modulation - was 150, now more sensitive
                const modulatedGain = Math.min(5.0, Math.max(minGain, effectiveRms * 300));

                // Use setTargetAtTime for smoother transitions and less artifacts
                gain.gain.setTargetAtTime(modulatedGain, ctx!.currentTime, 0.02); // Faster response for voice
            });

            // Log RMS every ~60 frames (approx 1 second)
            if (this.isPlayingBuffer && logCounter++ % 60 === 0) {
                const avgRms = totalRms / this.envelopeFollowers.length;
                console.log('[Vocoder] Avg RMS:', avgRms.toFixed(4),
                    'External carriers:', this.criosferaTap ? 'Criosfera' : '', this.gearheartTap ? 'Gearheart' : '');
            }

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

        // Update carrier balance - if we have external carriers, silence internal
        this.updateCarrierBalance();
    }

    private updateCarrierBalance(): void {
        if (!this.internalCarrierGain) {
            console.warn('[Vocoder] updateCarrierBalance called but internalCarrierGain is null');
            return;
        }

        const ctx = this.getContext();
        if (!ctx) return;

        // Check if we have external carriers connected
        const hasExternalCarrier = this.criosferaTap !== null || this.gearheartTap !== null;

        if (hasExternalCarrier) {
            // Silence internal carrier when external carriers are active
            // Let Criosfera/Gearheart be the sound source
            this.internalCarrierGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            console.log('[Vocoder] Internal carrier silenced - using external carriers');
        } else {
            // No external carriers - use internal carrier with viscosity-controlled balance
            // carrierBalance (from viscosity) controls how much internal carrier we use
            const internalWeight = 1.0 - this.carrierBalance;
            const internalGain = Math.max(0.1, internalWeight * 0.4); // Reduced to prevent overpowering
            this.internalCarrierGain.gain.setTargetAtTime(internalGain, ctx.currentTime, 0.1);
            console.log('[Vocoder] Using internal carrier, gain:', internalGain);
        }
    }

    /**
     * Enable/disable microphone input
     */
    async startRecording() {
        if (this.isRecording) return;
        const ctx = this.getContext();
        if (!ctx) return;

        // Stop any current playback
        this.stopPlayback();
        this.stopInternalCarrier();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            this.micStream = stream;
            this.audioChunks = [];

            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const arrayBuffer = await blob.arrayBuffer();
                    // Decode needs to happen on context
                    this.recordedBuffer = await ctx.decodeAudioData(arrayBuffer);
                    // normalizeBuffer(this.recordedBuffer); // DISABLED: Causing massive noise boost

                    // Stop stream tracks
                    stream.getTracks().forEach(track => track.stop());
                    this.micStream = null;

                    // Start Playing loop immediately
                    this.startPlaybackLoop();
                } catch (e) {
                    console.error("Error decoding audio", e);
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;

        } catch (err) {
            console.error("Mic access denied", err);
        }
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        this.mediaRecorder.stop();
        this.isRecording = false;
    }



    startPlaybackLoop() {
        if (!this.recordedBuffer) {
            console.error('[Vocoder] No recorded buffer available');
            return;
        }
        this.stopPlayback(); // Stop existing

        const ctx = this.getContext();
        if (!ctx || !this.micGain) {
            console.error('[Vocoder] No context or micGain');
            return;
        }

        console.log('[Vocoder] Starting playback loop, buffer duration:', this.recordedBuffer.duration);

        // Re-create internal carrier and reconnect to bands
        this.createInternalCarrier();

        // Ensure carrier is connected to bands
        if (this.internalCarrierGain) {
            this.carrierBands.forEach(band => {
                try {
                    this.internalCarrierGain!.connect(band);
                } catch (e) {
                    // Already connected
                }
            });
            console.log('[Vocoder] Carrier connected to', this.carrierBands.length, 'bands, gain:', this.internalCarrierGain.gain.value);
        }

        this.bufferSource = ctx.createBufferSource();
        this.bufferSource.buffer = this.recordedBuffer;
        this.bufferSource.loop = true;

        // Connect buffer to micGain which goes to modulator bands for envelope detection
        this.bufferSource.connect(this.micGain);
        console.log('[Vocoder] Buffer connected to micGain for modulation');

        this.bufferSource.start(0);
        this.isPlayingBuffer = true;
        console.log('[Vocoder] Playback started');
    }

    stopPlayback() {
        if (this.bufferSource) {
            try {
                this.bufferSource.stop();
                this.bufferSource.disconnect();
            } catch (e) { /* ignore */ }
            this.bufferSource = null;
        }
        this.stopInternalCarrier();
        this.isPlayingBuffer = false;
    }

    // Facade methods for UI
    getIsRecording() { return this.isRecording; }
    getIsPlayingBuffer() { return this.isPlayingBuffer; }

    // Deprecated but kept for compatibility logic (will be replaced in logic)
    async setMicEnabled(enabled: boolean) {
        if (enabled) {
            // Do nothing, UI calls startRecording now
        } else {
            this.stopRecording();
            this.stopPlayback();
        }
    }

    // Getters for previous UI props
    getIsMicActive() {
        return this.isRecording || this.isPlayingBuffer;
    }

    updateParameters(state: SynthState): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const t = ctx.currentTime;

        // Pressure -> Dry/Wet mix
        const wet = state.pressure;
        this.wetGain?.gain.setTargetAtTime(wet * 1.5, t, 0.1);  // Increased max wet level
        this.dryGain?.gain.setTargetAtTime((1 - wet) * 1.2, t, 0.1);  // Slightly boosted dry

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
        this.stopRecording();
        this.stopPlayback();

        // Cancel envelope following animation loop
        if (this.envelopeAnimationId !== null) {
            cancelAnimationFrame(this.envelopeAnimationId);
            this.envelopeAnimationId = null;
        }

        // Disconnect from external carrier sources
        this.setCarrierSources(null, null);
    }
}
