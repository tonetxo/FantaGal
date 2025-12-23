
import { SynthState } from '../../types';
import { ISynthEngine } from '../BaseSynthEngine';

export class GearheartEngine implements ISynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  
  // Reverb
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;

  // Percussion chain
  private percussionFilter: BiquadFilterNode | null = null;
  private distortion: WaveShaperNode | null = null;

  // Sequencer state
  private isPlaying: boolean = false;
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // s
  private timerID: number | null = null;

  private bpm: number = 90;
  private complexity: number = 0.5;
  private percussionResonance: number = 0.5;
  private percussionPressure: number = 0.5;
  private diffusion: number = 0.5; 

  async init(ctx: AudioContext) {
    this.ctx = ctx;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime); 
    this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime); 
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15; 

    // Reverb Setup
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.buildImpulse();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0;

    // Percussion Filter
    this.percussionFilter = this.ctx.createBiquadFilter();
    this.percussionFilter.type = 'lowpass';
    this.percussionFilter.frequency.value = 2000;
    this.percussionFilter.Q.value = 2;

    // Distortion for percussive sound
    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(0.05); 

    // Routing
    // Signal Flow: Osc -> Gain -> Distortion -> Filter -> (Dry + Reverb) -> Compressor -> Out
    this.masterGain.connect(this.distortion);
    this.distortion.connect(this.percussionFilter);
    
    // Dry path
    this.percussionFilter.connect(this.compressor);
    
    // Wet path (Reverb)
    this.percussionFilter.connect(this.reverb);
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);

    this.compressor.connect(this.ctx.destination);
  }

  private buildImpulse(): AudioBuffer | null {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = rate * 2.0; // 2 seconds tail
    const impulse = this.ctx.createBuffer(2, length, rate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            // Exponential decay for room sound
            const decay = Math.pow(1 - i / length, 4); 
            data[i] = (Math.random() * 2 - 1) * decay;
        }
    }
    return impulse;
  }

  private makeDistortionCurve(amount: number) {
    const k = amount * 100;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  updateParameters(state: SynthState) {
    if (!this.ctx || !this.masterGain || !this.percussionFilter) return;

    this.percussionPressure = state.pressure;
    this.percussionResonance = state.resonance;
    // Viscosity is handled by the UI sequencer now, but we keep mapped for consistency if needed later
    this.bpm = 60 + (state.viscosity * 120);
    this.complexity = state.turbulence;
    this.diffusion = state.diffusion;

    const t = this.ctx.currentTime;
    this.percussionFilter.Q.setTargetAtTime(1 + (this.percussionResonance * 10), t, 0.1); 
    this.masterGain.gain.setTargetAtTime(0.15 + (this.percussionPressure * 0.25), t, 0.1); 
    
    // Diffusion controls reverb mix (Dry/Wet)
    if (this.reverbGain) {
        // Max reverb gain 1.0
        this.reverbGain.gain.setTargetAtTime(this.diffusion * 1.5, t, 0.1);
    }
  }

  // O "playNote" en Gearheart agora reproduce sons de percusión
  // O parámetro 'frequency' interprétase agora como 'radio' do engranaxe
  playNote(radius: number, velocity?: number): number | undefined {
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    // Determinar se é o motor (bombo) ou outro engranaxe (timbal)
    // O motor ten radio 60. As outras teñen radios menores (25, 30, 40, 50).
    const isMotor = radius >= 58; 

    if (isMotor) {
      this.playKickDrum();
    } else {
      // Mapear o radio a un tamaño de timbal para determinar a frecuencia
      const drumFrequency = this.mapRadiusToDrumFrequency(radius);
      this.playTomDrum(drumFrequency);
    }

    return 1; // ID ficticio
  }

  private mapRadiusToDrumFrequency(radius: number): number {
    // Mapear radios de 25-60 a frecuencias de 60Hz-150Hz (máis graves)
    // Radio maior = frecuencia menor (timbal máis grave)
    const minRadius = 25;
    const maxRadius = 60;
    const minFreq = 60; // Lowered from 80
    const maxFreq = 150; // Lowered from 200

    // Normalizar o radio
    const normalized = (radius - minRadius) / (maxRadius - minRadius);
    // Inverter para que radio maior sexa frecuencia menor
    const freq = maxFreq - (normalized * (maxFreq - minFreq));

    return freq;
  }

  private playKickDrum() {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    
    // Parameters influenced by complexity and diffusion
    const decay = 0.3 + (this.complexity * 0.4); // Complexity increases sustain/decay
    const pitchDropSpeed = 0.1 + (this.diffusion * 0.2); // Diffusion affects how fast pitch drops (slower drop = more "boom")

    // Criar un bombo con unha caída de frecuencia (pitch bend)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';

    // Configurar a caída de frecuencia para simular un bombo
    osc.frequency.setValueAtTime(100, now); // Lowered from 150 for less click
    osc.frequency.exponentialRampToValueAtTime(30, now + pitchDropSpeed); // Lowered from 40 for deeper thud

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.8, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + decay);
  }

  private playTomDrum(frequency: number) {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    const decay = 0.2 + (this.complexity * 0.3);
    // Diffusion adds a slight pitch bend to toms too
    const pitchBend = this.diffusion * 20;

    // Criar un timbal con frecuencia específica
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency + pitchBend, now);
    osc.frequency.exponentialRampToValueAtTime(frequency, now + 0.1);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + decay);
  }

  stopNote() {
    // Non facemos nada, xa que os sons son por eventos, non por notas sustentadas
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
