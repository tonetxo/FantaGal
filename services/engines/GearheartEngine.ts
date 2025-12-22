
import { SynthState } from '../../types';
import { ISynthEngine } from '../BaseSynthEngine';

export class GearheartEngine implements ISynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  
  // Brass physical modeling chain
  private brassFilter: BiquadFilterNode | null = null;
  private saturator: WaveShaperNode | null = null;
  
  // Sequencer state
  private isPlaying: boolean = false;
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // s
  private timerID: number | null = null;
  
  private bpm: number = 90;
  private complexity: number = 0.5;
  private brassResonance: number = 0.5;
  private steamPressure: number = 0.5;

  async init(ctx: AudioContext) {
    this.ctx = ctx;
    
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; // Reduced from 0.6 to prevent clipping with multiple gears

    // Brass Resonator Filter
    this.brassFilter = this.ctx.createBiquadFilter();
    this.brassFilter.type = 'lowpass'; // Changed to Lowpass for warmer sound
    this.brassFilter.frequency.value = 2000;
    this.brassFilter.Q.value = 2;

    // Steam Saturation (Distortion)
    this.saturator = this.ctx.createWaveShaper();
    this.saturator.curve = this.makeSteamCurve(0.2); // Reduced saturation amount

    // Routing
    this.masterGain.connect(this.saturator);
    this.saturator.connect(this.brassFilter);
    this.brassFilter.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
  }

  private makeSteamCurve(amount: number) {
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
    if (!this.ctx || !this.masterGain || !this.brassFilter) return;
    
    // Mapeamos os parámetros de Criosfera aos de Gearheart temporalmente
    // ou usamos un estado extendido. Por agora mapeamos:
    // pressure -> steamPressure
    // resonance -> brassResonance
    // viscosity -> bpm (velocidade)
    // turbulence -> complexity
    
    this.steamPressure = state.pressure;
    this.brassResonance = state.resonance;
    this.bpm = 60 + (state.viscosity * 120);
    this.complexity = state.turbulence;

    const t = this.ctx.currentTime;
    this.brassFilter.Q.setTargetAtTime(2 + (this.brassResonance * 20), t, 0.1);
    this.masterGain.gain.setTargetAtTime(0.4 + (this.steamPressure * 0.4), t, 0.1);
  }

  // O "playNote" en Gearheart activa/desactiva o secuenciador
  playNote(frequency: number): number | undefined {
    if (!this.ctx) return;
    this.resume();
    
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.currentStep = 0;
      this.nextStepTime = this.ctx.currentTime;
      this.scheduler();
    } else {
      this.isPlaying = false;
      if (this.timerID) window.clearTimeout(this.timerID);
    }
    return 1; // ID ficticio
  }

  private scheduler() {
    while (this.ctx && this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextStepTime += 0.25 * secondsPerBeat; // Semicorcheas
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleNote(step: number, time: number) {
    if (!this.ctx || !this.masterGain) return;

    // Lóxica rítmica baseada en complexidade
    const shouldPlay = (step % 4 === 0) || (Math.random() < this.complexity && step % 2 === 0);
    if (!shouldPlay) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    
    // Frecuencia mecánica (máis ríxida)
    const freqBase = 110; // A2
    const scale = [0, 2, 3, 7, 8, 10]; // Escala menor "industrial"
    const note = scale[Math.floor(Math.random() * scale.length)];
    osc.frequency.setValueAtTime(freqBase * Math.pow(2, note / 12), time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, this.ctx.currentTime); // Use current time context for immediate triggers
    env.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.02); // Softer attack target
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3); // Longer decay for metallic ring

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.35);
  }

  stopNote() {
    // Non facemos nada, o secuenciador para con outro clic en playNote
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
