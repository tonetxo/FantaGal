import { SynthState } from '../../types';
import { ISynthEngine } from '../BaseSynthEngine';
import { makeDistortionCurve } from '../audioUtils';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

type VialType = 'mercury' | 'amber' | 'neutral';

export class EchoVesselEngine implements ISynthEngine {
    private ctx: AudioContext | null = null;

    // Input & Routing
    private micStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private inputGain: GainNode | null = null;
    private dryGain: GainNode | null = null;
    private wetGain: GainNode | null = null;
    private masterGain: GainNode | null = null;
    private analyser: AnalyserNode | null = null;
    private panner: PannerNode | null = null;

    // Mercury Vial (Ring Modulator)
    private mercuryOsc: OscillatorNode | null = null;
    private mercuryGain: GainNode | null = null; // The modulator

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
    private isInitialized: boolean = false;

    async init(ctx: AudioContext) {
        // Prevent double initialization
        if (this.isInitialized) return;

        this.ctx = ctx;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0; // Increased for better volume

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        // Spatial Audio (Gyroscope target)
        // Using 'equalpower' instead of 'HRTF' to avoid volume changes
        this.panner = this.ctx.createPanner();
        this.panner.panningModel = 'equalpower';
        this.panner.distanceModel = 'linear';
        this.panner.refDistance = 1;
        this.panner.maxDistance = 2;
        this.panner.rolloffFactor = 0; // No volume change with distance
        this.panner.positionX.value = 0;
        this.panner.positionY.value = 0;
        this.panner.positionZ.value = 1;

        // Internal routing gains
        this.inputGain = this.ctx.createGain();
        this.inputGain.gain.value = 0.85; // Balanced: not too loud to feedback, not too quiet
        this.dryGain = this.ctx.createGain();
        this.wetGain = this.ctx.createGain();

        // Anti-coupling high-pass filter (removes low frequencies that cause feedback)
        this.antiCouplingFilter = this.ctx.createBiquadFilter();
        this.antiCouplingFilter.type = 'highpass';
        this.antiCouplingFilter.frequency.value = 80; // Cut below 80Hz
        this.antiCouplingFilter.Q.value = 0.7;

        // Default Mix
        this.dryGain.gain.value = 1.0;
        this.wetGain.gain.value = 0.0;

        // Connect Chain
        // Mic -> InputGain -> [Dry/Wet Split]
        // Wet -> [Effect Chain] -> WetGain
        // [Dry + WetGain] -> Panner -> Master -> Dest

        this.inputGain.connect(this.dryGain);
        this.dryGain.connect(this.panner);
        this.wetGain.connect(this.panner);
        this.panner.connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        // Initialize Effects
        this.setupDelay(); // Initialize delay first as it's shared
        this.setupMercury();
        this.setupAmber();

        // NOTE: Removed TTS warm-up as it can trigger Android audio mode change
        // which reduces media volume. TTS will initialize on first actual use.

        // NOTE: Also removed mic preload here - requesting mic access on Android
        // triggers "communication mode" which reduces media volume.
        // Mic will be requested only when user explicitly enables it.

        this.isInitialized = true;
        this.setVial('neutral'); // Ensure initial connections are made!
    }

    // --- Microphone Handling ---

    private micPreparationPromise: Promise<void> | null = null;

    async prepareMic() {
        if (this.micStream) return; // Already prepared

        // If already preparing, wait for that one
        if (this.micPreparationPromise) {
            return this.micPreparationPromise;
        }

        this.micPreparationPromise = (async () => {
            try {
                console.log("Requesting Mic Access (Preload)...");
                this.micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,  // ENABLED to reduce feedback/coupling
                        noiseSuppression: false, // Keep false for natural sound
                        autoGainControl: false   // Keep false for consistent levels
                    }
                });
                console.log("Mic Access Granted (Preloaded)");
            } catch (err) {
                console.error("Error accessing microphone alchemy:", err);
                // Don't throw here, let the user try again manually if needed
            } finally {
                this.micPreparationPromise = null;
            }
        })();

        return this.micPreparationPromise;
    }

    async setMicEnabled(enabled: boolean) {
        if (enabled) {
            if (!this.micStream) {
                // Try to prepare if not ready
                await this.prepareMic();
            }

            if (!this.micStream || !this.ctx || !this.inputGain) return;

            // Start with gain at 0 for smooth fade-in
            const t = this.ctx.currentTime;
            this.inputGain.gain.setValueAtTime(0, t);

            // Connect if not already connected
            if (!this.micSource) {
                this.micSource = this.ctx.createMediaStreamSource(this.micStream);
                // Route through anti-coupling filter first
                this.micSource.connect(this.antiCouplingFilter!);
                this.antiCouplingFilter!.connect(this.inputGain);
            }

            // Enable tracks
            this.micStream.getAudioTracks().forEach(track => track.enabled = true);

            // Smooth fade-in to avoid click
            this.inputGain.gain.linearRampToValueAtTime(0.85, t + 0.05);

            this.isMicActive = true;
        } else {
            if (!this.ctx || !this.inputGain) {
                this.isMicActive = false;
                return;
            }

            // Smooth fade-out before disconnecting to avoid click
            const t = this.ctx.currentTime;
            this.inputGain.gain.setValueAtTime(this.inputGain.gain.value, t);
            this.inputGain.gain.linearRampToValueAtTime(0, t + 0.05);

            // Wait for fade-out, then fully stop
            setTimeout(() => {
                // FULLY STOP the mic stream so Android exits "communication mode"
                if (this.micStream) {
                    this.micStream.getAudioTracks().forEach(track => {
                        track.stop();
                    });
                }
                // Disconnect the source node
                if (this.micSource) {
                    this.micSource.disconnect();
                    this.micSource = null;
                }
                // Clear the stream reference
                this.micStream = null;
            }, 60);

            this.isMicActive = false;
        }
    }

    // Legacy method maintained for compatibility but redirected
    async startMic() {
        await this.setMicEnabled(true);
    }

    stopMic() {
        this.setMicEnabled(false);
    }

    // --- Effects Logic ---

    private setupDelay() {
        if (!this.ctx) return;

        // Tape Delay (Global)
        this.delay = this.ctx.createDelay(2.0);
        this.delay.delayTime.value = 0.35; // Default "Eco" time

        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.3;

        // Feedback loop
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
    }

    private setupMercury() {
        if (!this.ctx) return;
        // Ring Mod: Input * Oscillator
        // We implement this by connecting Input to a GainNode, and controlling that GainNode's gain with an Oscillator.

        this.mercuryOsc = this.ctx.createOscillator();
        this.mercuryOsc.type = 'sine';
        this.mercuryOsc.frequency.value = 30; // Low freq for tremolo/ring mod
        this.mercuryOsc.start();

        this.mercuryGain = this.ctx.createGain();
        this.mercuryGain.gain.value = 0; // Controlled by Osc

        // Connect Osc to Gain.gain
        // NOTE: Web Audio API allows connecting a node to an AudioParam
        this.mercuryOsc.connect(this.mercuryGain.gain);
    }

    private setupAmber() {
        if (!this.ctx) return;

        // Distortion
        this.distortion = this.ctx.createWaveShaper();
        this.distortion.curve = makeDistortionCurve(100); // Heavy saturation
        this.distortion.oversample = '4x';

        // Filter for dub feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        // Chain: Distortion -> Filter -> Delay (Global)
        this.distortion.connect(filter);
        if (this.delay) {
            filter.connect(this.delay);
        }
    }

    public setVial(vial: VialType) {
        if (!this.ctx || !this.inputGain) return;
        this.currentVial = vial;

        // Reset connections - strictly disconnect manageable nodes
        this.inputGain.disconnect();
        this.mercuryGain?.disconnect();
        this.distortion?.disconnect();
        this.delay?.disconnect();

        // Restore feedback loop (otherwise echo dies after 1 repetition)
        if (this.delay && this.delayFeedback) {
            this.delay.connect(this.delayFeedback);
            this.delayFeedback.connect(this.delay);
        }

        // Always connect input to dry for base signal
        this.inputGain.connect(this.dryGain!);

        if (vial === 'neutral') {
            // Clean delay with user control
            // Route input to delay
            this.inputGain.connect(this.delay!);
            // Delay output to wet
            this.delay!.connect(this.wetGain!);

            this.dryGain!.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
            // Wet gain (Echo volume) - ensure it's loud enough by default
            this.wetGain!.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.1);
        } else if (vial === 'mercury') {
            // Route input through mercury effect to wet
            this.inputGain.connect(this.mercuryGain!);
            this.mercuryGain!.connect(this.wetGain!);

            this.dryGain!.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.1);
            this.wetGain!.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.1);
        } else if (vial === 'amber') {
            // Route input through amber effect chain to wet
            this.inputGain.connect(this.distortion!);
            // Connect distortion output to both wet gain and delay
            this.distortion!.connect(this.wetGain!);
            this.distortion!.connect(this.delay!);
            // Also send delay output to wet gain
            this.delay!.connect(this.wetGain!);

            this.dryGain!.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.1);
            this.wetGain!.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.1);
        }
    }

    // --- Spatial Control ---

    public setOrientation(x: number, y: number) {
        // Map tilt (-1 to 1) to Panner position
        // X tilt -> Pan X
        // Y tilt -> Pan Z (Depth)
        if (this.panner && this.ctx) {
            const t = this.ctx.currentTime;
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



    // Sympathetic Resonance (Drone for TTS)
    private sympatheticOsc: OscillatorNode | null = null;
    private sympatheticGain: GainNode | null = null;

    public async speakOnce() {
        if (!this.currentSpeechText) return;

        try {
            await TextToSpeech.stop();

            // Start "Sympathetic Resonance" (Drone that feeds the effects)
            this.startSympatheticResonance();

            await TextToSpeech.speak({
                text: this.currentSpeechText,
                lang: 'es-ES',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'ambient',
            });

            // Stop resonance when speech finishes normally
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
        if (!this.ctx || !this.inputGain) return;

        // Stop any existing
        this.stopSympatheticResonance();

        const t = this.ctx.currentTime;

        this.sympatheticOsc = this.ctx.createOscillator();
        this.sympatheticGain = this.ctx.createGain();

        // Low drone based on turbulence
        // (Simulates the voice resonating in the pipes)
        this.sympatheticOsc.type = 'triangle';
        this.sympatheticOsc.frequency.value = 55 + (Math.random() * 20); // Deep A1 base + variation

        // Connect to InputGain so it goes through Mercury/Amber/Reverb
        this.sympatheticOsc.connect(this.sympatheticGain);
        this.sympatheticGain.connect(this.inputGain);

        this.sympatheticGain.gain.setValueAtTime(0, t);
        this.sympatheticGain.gain.linearRampToValueAtTime(0.3, t + 0.5); // Fade in

        this.sympatheticOsc.start(t);
    }

    private stopSympatheticResonance() {
        if (!this.ctx || !this.sympatheticOsc || !this.sympatheticGain) return;

        const t = this.ctx.currentTime;
        // Fade out
        this.sympatheticGain.gain.cancelScheduledValues(t);
        this.sympatheticGain.gain.setValueAtTime(this.sympatheticGain.gain.value, t);
        this.sympatheticGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

        this.sympatheticOsc.stop(t + 1.1);

        // Clean references
        const oldOsc = this.sympatheticOsc;
        setTimeout(() => { oldOsc.disconnect(); }, 1200);

        this.sympatheticOsc = null;
        this.sympatheticGain = null;
    }

    // --- Standard Interface Implementation ---

    updateParameters(state: SynthState) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        // Map global params to effect tweaks
        if (this.currentVial === 'mercury') {
            // Turbulence -> Modulator Frequency (30Hz to 600Hz)
            const freq = 30 + (state.turbulence * 570);
            this.mercuryOsc?.frequency.setTargetAtTime(freq, t, 0.1);
        } else if (this.currentVial === 'amber') {
            // Pressure -> Feedback amount
            const feedback = state.pressure * 0.9;
            this.delayFeedback?.gain.setTargetAtTime(feedback, t, 0.1);

            // Viscosity -> Delay Time
            const dTime = 0.1 + (state.viscosity * 1.0);
            this.delay?.delayTime.setTargetAtTime(dTime, t, 0.1);
        } else if (this.currentVial === 'neutral') {
            // Viscosity -> "ECO" (Amount + Feedback)
            const echoAmount = state.viscosity;

            // Wet gain increases with echo amount - Much louder (up to 80%)
            this.wetGain?.gain.setTargetAtTime(echoAmount * 0.8, t, 0.1);

            // Feedback increases with echo amount (up to 75%)
            this.delayFeedback?.gain.setTargetAtTime(echoAmount * 0.75, t, 0.1);
        }
    }

    playNote(freq: number, vel?: number): number | undefined {
        // Not used for Echo Vessel (it uses Mic or Speech)
        return undefined;
    }

    stopNote(id: number) { }

    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // Accessor for UI
    getIsMicActive() { return this.isMicActive; }
    getIsSpeechActive() { return this.speechActive; }
    public getAnalyser(): AnalyserNode | null { return this.analyser; }
}
