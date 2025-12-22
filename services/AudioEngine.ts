
import { SynthState } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private oscillators: Map<number, { osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode }> = new Map();
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(40, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    
    const lowPass = this.ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 1200;
    
    const impulseLength = this.ctx.sampleRate * 4;
    const impulse = this.ctx.createBuffer(2, impulseLength, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 3);
      }
    }
    
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = impulse;

    this.delay = this.ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.5;
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.value = 0.4;
    
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.1;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 150;

    // Routing: Signal -> masterGain -> lowPass -> Reverb/Delay -> Compressor -> Destination
    this.masterGain.connect(lowPass);
    lowPass.connect(this.reverb);
    lowPass.connect(this.delay);
    
    this.delay.connect(delayFeedback);
    delayFeedback.connect(this.delay);
    this.delay.connect(this.reverb);

    this.reverb.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.lfo.connect(this.lfoGain);
    this.lfo.start();
  }

  updateParameters(state: SynthState) {
    if (!this.ctx || !this.masterGain) return;
    
    const targetGain = 0.3 + (state.pressure * 0.9);
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);

    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(0.1 + state.turbulence * 15, this.ctx.currentTime, 0.1);
    }

    if (this.delay) {
      this.delay.delayTime.setTargetAtTime(0.1 + state.diffusion * 1.8, this.ctx.currentTime, 1.0);
    }
  }

  playNote(frequency: number, velocity: number = 0.8) {
    if (!this.ctx || !this.masterGain) return;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency * 1.5, this.ctx.currentTime);
    filter.Q.setValueAtTime(2 + (velocity * 15), this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(velocity, this.ctx.currentTime + 0.1);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    if (this.lfoGain) {
      this.lfoGain.connect(filter.frequency);
    }

    osc.start();
    
    const id = Date.now() + Math.random();
    this.oscillators.set(id, { osc, filter, gain });
    
    return id;
  }

  stopNote(id: number) {
    const note = this.oscillators.get(id);
    if (note && this.ctx) {
      // Slower release for pipe-like decay
      note.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      setTimeout(() => {
        note.osc.stop();
        note.osc.disconnect();
        this.oscillators.delete(id);
      }, 1000);
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}

export const audioEngine = new AudioEngine();
