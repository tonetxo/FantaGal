import { SynthState } from '../../types';
import { ISynthEngine } from '../BaseSynthEngine';
import { makeDistortionCurve } from '../audioUtils';

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

    // State
    private currentVial: VialType = 'neutral';
    private isMicActive: boolean = false;

    // AI Speech Generator
    private speechActive: boolean = false;
    private currentSpeechText: string = "";
    private synthesisVoice: SpeechSynthesisVoice | null = null;
    private isInitialized: boolean = false;

    async init(ctx: AudioContext) {
        // Prevent double initialization
        if (this.isInitialized) return;

        this.ctx = ctx;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        // Spatial Audio (Gyroscope target)
        this.panner = this.ctx.createPanner();
        this.panner.panningModel = 'HRTF';
        this.panner.distanceModel = 'inverse';
        this.panner.refDistance = 1;
        this.panner.maxDistance = 10000;
        this.panner.positionX.value = 0;
        this.panner.positionY.value = 0;
        this.panner.positionZ.value = 1; // In front of user

        // Internal routing gains
        this.inputGain = this.ctx.createGain();
        this.dryGain = this.ctx.createGain();
        this.wetGain = this.ctx.createGain();

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
        this.setupMercury();
        this.setupAmber();

        // Init Speech Voice
        this.loadVoices();
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }

        // Preload Mic Stream (Eager Init)
        this.prepareMic();

        this.isInitialized = true;
    }

    private loadVoices() {
        const voices = window.speechSynthesis.getVoices();
        // Try to find a deep or serious voice, fallback to first available
        this.synthesisVoice = voices.find(v => v.lang.includes('es') || v.lang.includes('en')) || voices[0] || null;
        console.log("EchoVessel Voices loaded:", voices.length, this.synthesisVoice?.name);
    }

    // --- Microphone Handling ---

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
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
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

            // Connect if not already connected
            if (!this.micSource) {
                this.micSource = this.ctx.createMediaStreamSource(this.micStream);
                this.micSource.connect(this.inputGain);
            }

            // Enable tracks
            this.micStream.getAudioTracks().forEach(track => track.enabled = true);
            this.isMicActive = true;
        } else {
            // Just disable tracks (mute), don't destroy stream
            if (this.micStream) {
                this.micStream.getAudioTracks().forEach(track => track.enabled = false);
            }
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

        // Tape Delay
        this.delay = this.ctx.createDelay(2.0);
        this.delay.delayTime.value = 0.4;

        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.4;

        // Filter for dub feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        // Chain: Distortion -> Filter -> Delay -> Feedback -> Delay
        this.distortion.connect(filter);
        filter.connect(this.delay);
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
    }

    public setVial(vial: VialType) {
        if (!this.ctx || !this.inputGain) return;
        this.currentVial = vial;

        // Reset connections
        this.inputGain.disconnect();
        this.mercuryGain?.disconnect();
        this.distortion?.disconnect();
        this.delay?.disconnect();

        // Always connect input to dry for base signal
        this.inputGain.connect(this.dryGain!);

        if (vial === 'neutral') {
            // Direct pass-through
            this.dryGain!.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
            this.wetGain!.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
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
            // Feedback loop for delay
            this.delay!.connect(this.delayFeedback!);
            this.delayFeedback!.connect(this.delay!);
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

    public speakOnce() {
        if (!this.currentSpeechText) return; // Speak regardless of speechActive state for one-time calls

        // Safety check for Browser/WebView compatibility
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
            console.warn("Speech Synthesis not supported in this environment.");
            return;
        }

        try {
            const utterance = new SpeechSynthesisUtterance(this.currentSpeechText);
            if (this.synthesisVoice) utterance.voice = this.synthesisVoice;

            // Alchemical Voice Settings
            utterance.pitch = 0.6; // Deep
            utterance.rate = 0.8; // Slow and deliberate
            utterance.volume = 0.6;

            // When speech ends, don't repeat - just finish
            utterance.onend = () => {
                // Speech has ended naturally
            };

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("Error initializing speech synthesis:", e);
        }
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
