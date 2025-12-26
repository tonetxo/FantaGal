
import { SynthState } from '../../types';
import { AbstractSynthEngine } from '../AbstractSynthEngine';
import { makeDistortionCurve, createReverbImpulse, createNoiseBuffer } from '../audioUtils';

/**
 * Criosfera Armónica - Deep resonance physical modeling synthesizer
 * Simulates giant organic pipes in cryogenic methane oceans.
 */
export class CriosferaEngine extends AbstractSynthEngine {
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

  // Use custom audio routing for this engine
  protected useDefaultRouting(): boolean {
    return false;
  }

  protected initializeEngine(): void {
    const ctx = this.getContext();
    const masterGain = this.getMasterGain();
    if (!ctx || !masterGain) return;

    // Set custom master gain
    masterGain.gain.value = 0.8;

    this.noiseBuffer = createNoiseBuffer(ctx, 2);

    this.lowPass = ctx.createBiquadFilter();
    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = 2000;
    this.lowPass.Q.value = 1;

    this.distortion = ctx.createWaveShaper();
    this.distortion.curve = makeDistortionCurve(0);
    this.distortion.oversample = '4x';

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = createReverbImpulse(ctx, 6, 2);

    this.delay = ctx.createDelay(4.0);
    this.delay.delayTime.value = 0.5;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.4;

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sawtooth';
    this.lfo.frequency.value = 0.1;

    this.lfoFilterGain = ctx.createGain();
    this.lfoFilterGain.gain.value = 0;

    this.lfoDelayGain = ctx.createGain();
    this.lfoDelayGain.gain.value = 0;

    // Custom audio routing: masterGain -> distortion -> lowPass -> {compressor, reverb, delay}
    masterGain.connect(this.distortion);
    this.distortion.connect(this.lowPass);

    this.lowPass.connect(this.compressor!);
    this.lowPass.connect(this.reverb);
    this.lowPass.connect(this.delay);

    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.compressor!);

    this.reverb.connect(this.compressor!);

    this.compressor!.connect(ctx.destination);

    this.lfo.connect(this.lfoFilterGain);
    this.lfoFilterGain.connect(this.lowPass.frequency);

    this.lfo.connect(this.lfoDelayGain);
    this.lfoDelayGain.connect(this.delay.delayTime);

    this.lfo.start();
  }

  updateParameters(state: SynthState) {
    const ctx = this.getContext();
    const masterGain = this.getMasterGain();
    if (!ctx || !masterGain || !this.lowPass || !this.delayFeedback || !this.distortion) return;

    this.currentState = state;
    const timeConstant = 0.2;

    const targetGain = 0.2 + (state.pressure * 0.6);
    masterGain.gain.setTargetAtTime(targetGain, ctx.currentTime, timeConstant);

    if (this.lfo && this.lfoFilterGain && this.lfoDelayGain) {
      const lfoSpeed = 0.1 + Math.pow(state.turbulence, 2) * 25;
      this.lfo.frequency.setTargetAtTime(lfoSpeed, ctx.currentTime, timeConstant);

      const filterDepth = 50 + Math.pow(state.turbulence, 2) * 3000;
      this.lfoFilterGain.gain.setTargetAtTime(filterDepth, ctx.currentTime, timeConstant);

      const delayModDepth = state.turbulence * 0.02;
      this.lfoDelayGain.gain.setTargetAtTime(delayModDepth, ctx.currentTime, timeConstant);
    }

    const minFreq = 100;
    const maxFreq = 10000;
    const viscosityFreq = maxFreq - (state.viscosity * (maxFreq - minFreq));
    this.lowPass.frequency.setTargetAtTime(Math.max(minFreq, viscosityFreq), ctx.currentTime, timeConstant);

    this.lowPass.Q.setTargetAtTime(0.5 + (state.resonance * 15), ctx.currentTime, timeConstant);
    this.delayFeedback.gain.setTargetAtTime(0.1 + (state.resonance * 0.85), ctx.currentTime, timeConstant);

    if (this.delay) {
      this.delay.delayTime.setTargetAtTime(0.1 + state.diffusion * 2.5, ctx.currentTime, 1.0);
    }
  }

  playNote(frequency: number, velocity: number = 0.8): number | undefined {
    const ctx = this.getContext();
    const masterGain = this.getMasterGain();
    if (!ctx || !masterGain || !this.noiseBuffer) return;

    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(frequency, t);
    osc1.detune.setValueAtTime((Math.random() - 0.5) * 15, t);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(frequency, t);
    osc2.detune.setValueAtTime((Math.random() - 0.5) * 25 - 15, t);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = frequency * 2;
    noiseFilter.Q.value = 1;

    const toneHighPass = ctx.createBiquadFilter();
    toneHighPass.type = 'highpass';
    toneHighPass.frequency.setValueAtTime(frequency * 0.9, t);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 0.8, t);
    filter.frequency.exponentialRampToValueAtTime(frequency * 3, t + 1.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    // Faster attack to avoid slow fade-in, but still smooth
    gain.gain.linearRampToValueAtTime(velocity * 0.6, t + 0.02);

    // Start oscillator gains at 0 and ramp up to avoid clicks
    const osc1Gain = ctx.createGain();
    osc1Gain.gain.setValueAtTime(0, t);
    osc1Gain.gain.linearRampToValueAtTime(0.15, t + 0.01);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0, t);
    osc2Gain.gain.linearRampToValueAtTime(0.1, t + 0.01);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.6, t + 0.01);

    osc1.connect(toneHighPass);
    osc2.connect(toneHighPass);

    toneHighPass.connect(osc1Gain).connect(filter);
    toneHighPass.connect(osc2Gain).connect(filter);

    noise.connect(noiseFilter).connect(noiseGain).connect(filter);

    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start();
    osc2.start();
    noise.start();

    const id = Date.now() + Math.random();
    this.oscillators.set(id, { osc1, osc2, noise, filter, gain });

    return id;
  }

  stopNote(id: number) {
    const note = this.oscillators.get(id);
    const ctx = this.getContext();
    if (note && ctx) {
      const releaseTime = 1.0 + (this.currentState ? this.currentState.viscosity * 3 : 0);

      const t = ctx.currentTime;

      // Get current value first, then cancel, then set from current value to avoid clicks
      const currentGain = note.gain.gain.value;
      note.gain.gain.cancelScheduledValues(t);
      note.gain.gain.setValueAtTime(currentGain, t);
      note.gain.gain.linearRampToValueAtTime(0, t + releaseTime * 0.3);

      const currentFreq = note.filter.frequency.value;
      note.filter.frequency.cancelScheduledValues(t);
      note.filter.frequency.setValueAtTime(currentFreq, t);
      note.filter.frequency.linearRampToValueAtTime(50, t + releaseTime * 0.3);

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
}
