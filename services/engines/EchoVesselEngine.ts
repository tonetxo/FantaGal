import { SynthState } from '../../types';
import { AbstractSynthEngine } from '../AbstractSynthEngine';
import { makeDistortionCurve } from '../audioUtils';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

type VialType = 'mercury' | 'amber' | 'neutral';

/**
 * Echo Vessel Engine - Microphone effects processor with spatial audio.
 * Now extends AbstractSynthEngine for consistent architecture.
 */
export class EchoVesselEngine extends AbstractSynthEngine {
    // Input & Routing
    private micStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private inputGain: GainNode | null = null;
    private dryGain: GainNode | null = null;
    private wetGain: GainNode | null = null;
    private analyser: AnalyserNode | null = null;
    private panner: PannerNode | null = null;

    // Mercury Vial (Ring Modulator)
    private mercuryOsc: OscillatorNode | null = null;
    private mercuryGain: GainNode | null = null;

    // Amber Vial (Distortion + Delay)
    private distortion: WaveShaperNode | null = null;
    private delay: DelayNode | null = null;
    private delayFeedback: GainNode | null = null;

    // Anti-feedback filter
    private antiCouplingFilter: BiquadFilterNode | null = null;

    // State
    private currentVial: VialType = 'neutral';
    private isMicActive: boolean = false;

    // AI Speech Generator
    private speechActive: boolean = false;
    private currentSpeechText: string = "";

    // Sympathetic Resonance (Drone for TTS)
    private sympatheticOsc: OscillatorNode | null = null;
    private sympatheticGain: GainNode | null = null;

    // Mic preparation promise
    private micPreparationPromise: Promise<void> | null = null;

    // Use custom routing (no compressor, custom chain)
    protected useDefaultRouting(): boolean {
        return false;
    }

    protected initializeEngine(): void {
        const ctx = this.getContext();
        const masterGain = this.getMasterGain();
        if (!ctx || !masterGain) return;

        // Set custom master gain
        masterGain.gain.value = 1.0;

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        // Spatial Audio (Gyroscope target)
        this.panner = ctx.createPanner();
        this.panner.panningModel = 'equalpower';
        this.panner.distanceModel = 'linear';
        this.panner.refDistance = 1;
        this.panner.maxDistance = 2;
        this.panner.rolloffFactor = 0;
        this.panner.positionX.value = 0;
        this.panner.positionY.value = 0;
        this.panner.positionZ.value = 1;

        // Internal routing gains
        this.inputGain = ctx.createGain();
        this.inputGain.gain.value = 0.85;
        this.dryGain = ctx.createGain();
        this.wetGain = ctx.createGain();

        // Anti-coupling high-pass filter (removes low frequencies that cause feedback)
        this.antiCouplingFilter = ctx.createBiquadFilter();
        this.antiCouplingFilter.type = 'highpass';
        this.antiCouplingFilter.frequency.value = 80;
        this.antiCouplingFilter.Q.value = 0.7;

        // Default Mix
        this.dryGain.gain.value = 1.0;
        this.wetGain.gain.value = 0.0;

        // Connect Chain: [Dry + Wet] -> Panner -> Master -> Analyser -> Destination
        this.inputGain.connect(this.dryGain);
        this.dryGain.connect(this.panner);
        this.wetGain.connect(this.panner);
        this.panner.connect(masterGain);
        masterGain.connect(this.analyser);
        this.analyser.connect(ctx.destination);

        // Initialize Effects
        this.setupDelay();
        this.setupMercury();
        this.setupAmber();

        this.setVial('neutral');
    }

    // --- Microphone Handling ---

    async prepareMic() {
        if (this.micStream) return;

        if (this.micPreparationPromise) {
            return this.micPreparationPromise;
        }

        this.micPreparationPromise = (async () => {
            try {
                this.micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
            } catch (err) {
                console.error("Error accessing microphone:", err);
            } finally {
                this.micPreparationPromise = null;
            }
        })();

        return this.micPreparationPromise;
    }

    async setMicEnabled(enabled: boolean) {
        const ctx = this.getContext();
        if (enabled) {
            if (!this.micStream) {
                await this.prepareMic();
            }

            if (!this.micStream || !ctx || !this.inputGain) return;

            const t = ctx.currentTime;
            this.inputGain.gain.setValueAtTime(0, t);

            if (!this.micSource) {
                this.micSource = ctx.createMediaStreamSource(this.micStream);
                this.micSource.connect(this.antiCouplingFilter!);
                this.antiCouplingFilter!.connect(this.inputGain);
            }

            this.micStream.getAudioTracks().forEach(track => track.enabled = true);
            this.inputGain.gain.linearRampToValueAtTime(0.85, t + 0.05);
            this.isMicActive = true;
        } else {
            if (!ctx || !this.inputGain) {
                this.isMicActive = false;
                return;
            }

            const t = ctx.currentTime;
            this.inputGain.gain.setValueAtTime(this.inputGain.gain.value, t);
            this.inputGain.gain.linearRampToValueAtTime(0, t + 0.05);

            setTimeout(() => {
                if (this.micStream) {
                    this.micStream.getAudioTracks().forEach(track => track.stop());
                }
                if (this.micSource) {
                    this.micSource.disconnect();
                    this.micSource = null;
                }
                this.micStream = null;
            }, 60);

            this.isMicActive = false;
        }
    }

    async startMic() {
        await this.setMicEnabled(true);
    }

    stopMic() {
        this.setMicEnabled(false);
    }

    // --- Effects Logic ---

    private setupDelay() {
        const ctx = this.getContext();
        if (!ctx) return;

        this.delay = ctx.createDelay(2.0);
        this.delay.delayTime.value = 0.35;

        this.delayFeedback = ctx.createGain();
        this.delayFeedback.gain.value = 0.3;

        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
    }

    private setupMercury() {
        const ctx = this.getContext();
        if (!ctx) return;

        this.mercuryOsc = ctx.createOscillator();
        this.mercuryOsc.type = 'sine';
        this.mercuryOsc.frequency.value = 30;
        this.mercuryOsc.start();

        this.mercuryGain = ctx.createGain();
        this.mercuryGain.gain.value = 0;

        this.mercuryOsc.connect(this.mercuryGain.gain);
    }

    private setupAmber() {
        const ctx = this.getContext();
        if (!ctx) return;

        this.distortion = ctx.createWaveShaper();
        this.distortion.curve = makeDistortionCurve(100);
        this.distortion.oversample = '4x';

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        this.distortion.connect(filter);
        if (this.delay) {
            filter.connect(this.delay);
        }
    }

    public setVial(vial: VialType) {
        const ctx = this.getContext();
        if (!ctx || !this.inputGain) return;
        this.currentVial = vial;

        this.inputGain.disconnect();
        this.mercuryGain?.disconnect();
        this.distortion?.disconnect();
        this.delay?.disconnect();

        if (this.delay && this.delayFeedback) {
            this.delay.connect(this.delayFeedback);
            this.delayFeedback.connect(this.delay);
        }

        this.inputGain.connect(this.dryGain!);

        if (vial === 'neutral') {
            this.inputGain.connect(this.delay!);
            this.delay!.connect(this.wetGain!);
            this.dryGain!.gain.setTargetAtTime(1.0, ctx.currentTime, 0.1);
            this.wetGain!.gain.setTargetAtTime(0.5, ctx.currentTime, 0.1);
        } else if (vial === 'mercury') {
            this.inputGain.connect(this.mercuryGain!);
            this.mercuryGain!.connect(this.wetGain!);
            this.dryGain!.gain.setTargetAtTime(0.3, ctx.currentTime, 0.1);
            this.wetGain!.gain.setTargetAtTime(0.7, ctx.currentTime, 0.1);
        } else if (vial === 'amber') {
            this.inputGain.connect(this.distortion!);
            this.distortion!.connect(this.wetGain!);
            this.distortion!.connect(this.delay!);
            this.delay!.connect(this.wetGain!);
            this.dryGain!.gain.setTargetAtTime(0.4, ctx.currentTime, 0.1);
            this.wetGain!.gain.setTargetAtTime(0.6, ctx.currentTime, 0.1);
        }
    }

    // --- Spatial Control ---

    public setOrientation(x: number, y: number) {
        const ctx = this.getContext();
        if (this.panner && ctx) {
            const t = ctx.currentTime;
            this.panner.positionX.setTargetAtTime(x * 5, t, 0.1);
            this.panner.positionZ.setTargetAtTime(Math.max(0.1, 1 + y * 2), t, 0.1);
        }
    }

    // --- AI Speech Generator ---

    public setSpeechText(text: string) {
        this.currentSpeechText = text;
    }

    public setSpeechActive(active: boolean) {
        this.speechActive = active;
        if (active && this.currentSpeechText) {
            this.speakOnce();
        } else if (!active) {
            window.speechSynthesis.cancel();
        }
    }

    public async speakOnce() {
        if (!this.currentSpeechText) return;

        try {
            await TextToSpeech.stop();
            this.startSympatheticResonance();

            await TextToSpeech.speak({
                text: this.currentSpeechText,
                lang: 'es-ES',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'ambient',
            });

            this.stopSympatheticResonance();
        } catch (e) {
            console.error("TTS Error:", e);
            this.stopSympatheticResonance();
        }
    }

    public async stopSpeech() {
        try {
            this.stopSympatheticResonance();
            await TextToSpeech.stop();
        } catch (e) {
            console.error("TTS Stop Error:", e);
        }
    }

    private startSympatheticResonance() {
        const ctx = this.getContext();
        if (!ctx || !this.inputGain) return;

        this.stopSympatheticResonance();

        const t = ctx.currentTime;

        this.sympatheticOsc = ctx.createOscillator();
        this.sympatheticGain = ctx.createGain();

        this.sympatheticOsc.type = 'triangle';
        this.sympatheticOsc.frequency.value = 55 + (Math.random() * 20);

        this.sympatheticOsc.connect(this.sympatheticGain);
        this.sympatheticGain.connect(this.inputGain);

        this.sympatheticGain.gain.setValueAtTime(0, t);
        this.sympatheticGain.gain.linearRampToValueAtTime(0.3, t + 0.5);

        this.sympatheticOsc.start(t);
    }

    private stopSympatheticResonance() {
        const ctx = this.getContext();
        if (!ctx || !this.sympatheticOsc || !this.sympatheticGain) return;

        const t = ctx.currentTime;
        this.sympatheticGain.gain.cancelScheduledValues(t);
        this.sympatheticGain.gain.setValueAtTime(this.sympatheticGain.gain.value, t);
        this.sympatheticGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

        this.sympatheticOsc.stop(t + 1.1);

        const oldOsc = this.sympatheticOsc;
        setTimeout(() => { oldOsc.disconnect(); }, 1200);

        this.sympatheticOsc = null;
        this.sympatheticGain = null;
    }

    // --- Abstract method implementations ---

    updateParameters(state: SynthState) {
        const ctx = this.getContext();
        if (!ctx) return;
        const t = ctx.currentTime;

        if (this.currentVial === 'mercury') {
            const freq = 30 + (state.turbulence * 570);
            this.mercuryOsc?.frequency.setTargetAtTime(freq, t, 0.1);
        } else if (this.currentVial === 'amber') {
            const feedback = state.pressure * 0.9;
            this.delayFeedback?.gain.setTargetAtTime(feedback, t, 0.1);

            const dTime = 0.1 + (state.viscosity * 1.0);
            this.delay?.delayTime.setTargetAtTime(dTime, t, 0.1);
        } else if (this.currentVial === 'neutral') {
            const echoAmount = state.viscosity;
            this.wetGain?.gain.setTargetAtTime(echoAmount * 0.8, t, 0.1);
            this.delayFeedback?.gain.setTargetAtTime(echoAmount * 0.75, t, 0.1);
        }
    }

    playNote(freq: number, vel?: number): number | undefined {
        return undefined;
    }

    stopNote(id: number): void { }

    // --- Reset method for cleanup ---

    reset(): void {
        if (this.isMicActive) {
            this.setMicEnabled(false);
        }
        this.stopSpeech();
    }

    // --- Accessors for UI ---

    getIsMicActive() { return this.isMicActive; }
    getIsSpeechActive() { return this.speechActive; }
    public getAnalyser(): AnalyserNode | null { return this.analyser; }
}
