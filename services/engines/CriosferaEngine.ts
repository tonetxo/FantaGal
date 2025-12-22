
import { SynthState } from '../../types';
import { ISynthEngine } from '../BaseSynthEngine';

export class CriosferaEngine implements ISynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private oscillators: Map<number, { 
    osc1: OscillatorNode; 
    osc2: OscillatorNode; 
    noise: AudioBufferSourceNode;
    filter: BiquadFilterNode; 
    gain: GainNode 
  }> = new Map();
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private lowPass: BiquadFilterNode | null = null;
  private distortion: WaveShaperNode | null = null;
  
  private lfo: OscillatorNode | null = null;
  private lfoFilterGain: GainNode | null = null;
  private lfoDelayGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private currentState: SynthState | null = null;

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    this.lowPass = this.ctx.createBiquadFilter();
    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = 2000;
    this.lowPass.Q.value = 1;

    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(0);
    this.distortion.oversample = '4x';
    
    const impulseLength = this.ctx.sampleRate * 6;
    const impulse = this.ctx.createBuffer(2, impulseLength, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const impData = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        impData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
      }
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = impulse;

    this.delay = this.ctx.createDelay(4.0);
    this.delay.delayTime.value = 0.5;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.4;

    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sawtooth';
    this.lfo.frequency.value = 0.1;

    this.lfoFilterGain = this.ctx.createGain();
    this.lfoFilterGain.gain.value = 0;

    this.lfoDelayGain = this.ctx.createGain();
    this.lfoDelayGain.gain.value = 0;

    this.masterGain.connect(this.distortion);
    this.distortion.connect(this.lowPass);

    this.lowPass.connect(this.compressor);
    this.lowPass.connect(this.reverb);
    this.lowPass.connect(this.delay);
    
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.compressor);

    this.reverb.connect(this.compressor);

    this.compressor.connect(this.ctx.destination);

    this.lfo.connect(this.lfoFilterGain);
    this.lfoFilterGain.connect(this.lowPass.frequency);

    this.lfo.connect(this.lfoDelayGain);
    this.lfoDelayGain.connect(this.delay.delayTime);
    
    this.lfo.start();
  }

  private makeDistortionCurve(amount: number) {
    const k = amount; 
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  updateParameters(state: SynthState) {
    if (!this.ctx || !this.masterGain || !this.lowPass || !this.delayFeedback || !this.distortion) return;
    
    this.currentState = state;
    const timeConstant = 0.2; 

    const targetGain = 0.2 + (state.pressure * 0.6);
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, timeConstant);
    
    if (this.lfo && this.lfoFilterGain && this.lfoDelayGain) {
      const lfoSpeed = 0.1 + Math.pow(state.turbulence, 2) * 25;
      this.lfo.frequency.setTargetAtTime(lfoSpeed, this.ctx.currentTime, timeConstant);

      const filterDepth = 50 + Math.pow(state.turbulence, 2) * 3000;
      this.lfoFilterGain.gain.setTargetAtTime(filterDepth, this.ctx.currentTime, timeConstant);

      const delayModDepth = state.turbulence * 0.02; 
      this.lfoDelayGain.gain.setTargetAtTime(delayModDepth, this.ctx.currentTime, timeConstant);
    }

    const minFreq = 100;
    const maxFreq = 10000;
    const viscosityFreq = maxFreq - (state.viscosity * (maxFreq - minFreq)); 
    this.lowPass.frequency.setTargetAtTime(Math.max(minFreq, viscosityFreq), this.ctx.currentTime, timeConstant);

    this.lowPass.Q.setTargetAtTime(0.5 + (state.resonance * 15), this.ctx.currentTime, timeConstant);
    this.delayFeedback.gain.setTargetAtTime(0.1 + (state.resonance * 0.85), this.ctx.currentTime, timeConstant); 

    if (this.delay) {
      this.delay.delayTime.setTargetAtTime(0.1 + state.diffusion * 2.5, this.ctx.currentTime, 1.0);
    }
  }

  playNote(frequency: number, velocity: number = 0.8) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    
    const t = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(frequency, t);
    osc1.detune.setValueAtTime((Math.random() - 0.5) * 15, t); 

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(frequency, t);
    osc2.detune.setValueAtTime((Math.random() - 0.5) * 25 - 15, t);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = frequency * 2;
    noiseFilter.Q.value = 1;

    const toneHighPass = this.ctx.createBiquadFilter();
    toneHighPass.type = 'highpass';
    toneHighPass.frequency.setValueAtTime(frequency * 0.9, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 0.8, t); 
    filter.frequency.exponentialRampToValueAtTime(frequency * 3, t + 1.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.setTargetAtTime(velocity * 0.6, t, 0.5); 
    
    const osc1Gain = this.ctx.createGain();
    osc1Gain.gain.value = 0.15;
    
    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = 0.1;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.6;

    osc1.connect(toneHighPass);
    osc2.connect(toneHighPass);
    
    toneHighPass.connect(osc1Gain).connect(filter);
    toneHighPass.connect(osc2Gain).connect(filter);
    
    noise.connect(noiseFilter).connect(noiseGain).connect(filter);

    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    noise.start();
    
    const id = Date.now() + Math.random();
    this.oscillators.set(id, { osc1, osc2, noise, filter, gain });
    
    return id;
  }

  stopNote(id: number) {
    const note = this.oscillators.get(id);
    if (note && this.ctx) {
      const releaseTime = 1.0 + (this.currentState ? this.currentState.viscosity * 3 : 0);
      
      const t = this.ctx.currentTime;
      note.gain.gain.cancelScheduledValues(t);
      note.gain.gain.setTargetAtTime(0, t, releaseTime * 0.2); 
      
      note.filter.frequency.cancelScheduledValues(t);
      note.filter.frequency.setTargetAtTime(50, t, releaseTime * 0.2);

      setTimeout(() => {
        if (this.oscillators.has(id)) {
            note.osc1.stop();
            note.osc2.stop();
            note.noise.stop();
            note.osc1.disconnect();
            note.osc2.disconnect();
            note.noise.disconnect();
            this.oscillators.delete(id);
        }
      }, releaseTime * 1000 + 500);
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
