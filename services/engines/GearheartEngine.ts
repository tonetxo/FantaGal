
import { SynthState } from '../../types';
import { ISynthEngine } from '../BaseSynthEngine';
import { makeSoftDistortionCurve, createReverbImpulse } from '../audioUtils';

export interface Gear {
  id: number;
  x: number;
  y: number;
  radius: number;
  teeth: number;
  angle: number;
  speed: number;
  isDragging: boolean;
  isConnected: boolean;
  material: 'bronze' | 'copper' | 'gold' | 'platinum' | 'iron';
}

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

  // Physics & Sequencer State
  private gears: Gear[] = [];
  private animationFrameId: number | null = null;

  // State from React (mirrored here for physics)
  private speedMultiplier: number = 1;
  private turbulence: number = 0.5;
  public vibration: number = 0; // Exposed for UI

  // Motor State
  public isMotorActive: boolean = true;
  private isInitialized: boolean = false;

  constructor() {
    // Empty constructor - everything is done in init() for lazy loading
  }

  // --- Audio Setup (Existing) ---

  async init(ctx: AudioContext) {
    // Prevent double initialization
    if (this.isInitialized) return;

    this.ctx = ctx;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

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
    this.distortion.curve = makeSoftDistortionCurve(0.05);

    // Routing
    this.masterGain.connect(this.distortion);
    this.distortion.connect(this.percussionFilter);

    this.percussionFilter.connect(this.compressor); // Dry
    this.percussionFilter.connect(this.reverb);     // Wet Send
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);

    this.compressor.connect(this.ctx.destination);

    // Initialize gears and start physics loop only when initialized
    this.initGears();
    this.startPhysicsLoop();
    this.isInitialized = true;
  }

  private buildImpulse(): AudioBuffer | null {
    if (!this.ctx) return null;
    return createReverbImpulse(this.ctx, 2.0, 4);
  }

  // --- Physics Engine ---

  private initGears() {
    // Default initial gears
    const width = typeof window !== 'undefined' ? window.innerWidth : 800;
    const height = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600;
    const centerX = width / 2;

    this.gears = [
      { id: 0, x: 150, y: 300, radius: 60, teeth: 12, angle: 0, speed: 0.02, isDragging: false, isConnected: true, material: 'iron' }, // Motor
      { id: 1, x: 300, y: 200, radius: 40, teeth: 8, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'bronze' },
      { id: 2, x: 100, y: 150, radius: 30, teeth: 6, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'copper' },
      { id: 3, x: 250, y: 400, radius: 50, teeth: 10, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'gold' },
      { id: 4, x: 200, y: 100, radius: 25, teeth: 5, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'platinum' },
    ];
  }

  public setGearConfig(gearConfig: { numGears: number; arrangement: string } | null) {
    if (!gearConfig) return;

    const newGears: Gear[] = [];
    const width = window.innerWidth;
    const height = window.innerHeight * 0.6;
    const centerX = width / 2;
    const centerY = height / 2;

    // Always add Motor first
    newGears.push({
      id: 0,
      x: centerX,
      y: height - 100,
      radius: 60,
      teeth: 12,
      angle: 0,
      speed: 0.02,
      isDragging: false,
      isConnected: true,
      material: 'iron'
    });

    const count = Math.max(3, Math.min(8, gearConfig.numGears));
    const materials: ('bronze' | 'copper' | 'gold' | 'platinum')[] = ['bronze', 'copper', 'gold', 'platinum'];

    for (let i = 1; i < count; i++) {
      let x, y, r;

      if (gearConfig.arrangement === 'linear') {
        x = (width / (count + 1)) * (i + 1);
        y = centerY;
        r = 30 + Math.random() * 20;
      } else if (gearConfig.arrangement === 'cluster') {
        const angle = (Math.PI * 2 * i) / count;
        x = centerX + Math.cos(angle) * 100;
        y = centerY + Math.sin(angle) * 100;
        r = 25 + Math.random() * 25;
      } else { // chaotic
        x = Math.random() * (width - 100) + 50;
        y = Math.random() * (height - 100) + 50;
        r = 20 + Math.random() * 40;
      }

      newGears.push({
        id: i,
        x: x,
        y: y,
        radius: r,
        teeth: Math.floor(r / 5),
        angle: 0,
        speed: 0,
        isDragging: false,
        isConnected: false,
        material: materials[i % materials.length]
      });
    }
    this.gears = newGears;
  }

  public getGears(): Gear[] {
    // Return empty array if not initialized
    if (!this.isInitialized) return [];
    return this.gears;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public updateGearPosition(id: number, x: number, y: number) {
    const gear = this.gears.find(g => g.id === id);
    if (gear) {
      gear.x = x;
      gear.y = y;
      gear.isDragging = true; // Mark as dragging so physics knows
    }
  }

  public endDrag(id: number) {
    const gear = this.gears.find(g => g.id === id);
    if (gear) {
      gear.isDragging = false;
    }
  }

  public toggleMotor() {
    this.isMotorActive = !this.isMotorActive;
    this.gears[0].isConnected = this.isMotorActive;
  }

  public startPhysicsLoop() {
    const loop = () => {
      this.updatePhysics();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stops the physics loop. Should be called when switching engines or cleaning up.
   */
  public stopPhysicsLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Cleanup method to be called when destroying the engine.
   */
  public destroy() {
    this.stopPhysicsLoop();
    this.gears = [];
  }

  private updatePhysics() {
    // Decay vibration for UI read
    if (this.vibration > 0) this.vibration *= 0.9;

    const gears = this.gears;
    if (gears.length === 0) return;

    // Update Motor
    gears[0].isConnected = this.isMotorActive;
    gears[0].speed = this.isMotorActive ? 0.02 * this.speedMultiplier : 0;

    // Reset non-motors/non-connected
    for (let i = 1; i < gears.length; i++) {
      if (gears[i].isDragging) {
        gears[i].isConnected = false;
        gears[i].speed = 0;
      } else {
        gears[i].isConnected = false;
        gears[i].speed = 0;
      }
    }

    // Energy Propagation (Iterative Flood Fill)
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;

      for (let i = 0; i < gears.length; i++) {
        if (!gears[i].isConnected) continue;

        for (let j = 0; j < gears.length; j++) {
          if (i === j) continue;
          if (gears[j].isDragging) continue;
          if (gears[j].isConnected) continue;

          const dx = gears[i].x - gears[j].x;
          const dy = gears[i].y - gears[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const combinedRadius = gears[i].radius + gears[j].radius;
          const margin = 12;

          if (dist < combinedRadius + margin) {
            gears[j].isConnected = true;
            gears[j].speed = -gears[i].speed * (gears[i].radius / gears[j].radius);
            changed = true;
          }
        }
      }
    }

    // Update Angles and Trigger Sound
    gears.forEach(g => {
      if (g.isConnected) {
        const prevAngle = g.angle;
        g.angle += g.speed;

        const normPrev = Math.abs(prevAngle % (Math.PI * 2));
        const normCurr = Math.abs(g.angle % (Math.PI * 2));

        // Check for full rotation (trigger)
        if (normCurr < normPrev && Math.abs(normCurr - normPrev) > 0.1) {
          // INTERNAL AUDIO TRIGGER
          this.internalTrigger(g.radius, g.id);
        }
      }
    });
  }

  private internalTrigger(radius: number, id: number) {
    // Play sound
    this.playNote(radius);

    // Update internal vibration state for UI
    this.vibration += (id === 0 ? 10 : 3);
    if (this.vibration > 15) this.vibration = 15;
  }

  // --- Parameter Updates ---

  updateParameters(state: SynthState) {
    if (!this.ctx || !this.masterGain || !this.percussionFilter) return;

    // Map SynthState to Engine Params
    this.speedMultiplier = 0.5 + (state.viscosity * 1.5); // Viscosity controls Global Speed
    this.turbulence = state.turbulence;

    // Existing Audio Params
    const t = this.ctx.currentTime;
    this.percussionFilter.Q.setTargetAtTime(1 + (state.resonance * 10), t, 0.1);
    this.masterGain.gain.setTargetAtTime(0.15 + (state.pressure * 0.25), t, 0.1);
    if (this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(state.diffusion * 1.5, t, 0.1);
    }
  }

  // --- Audio Methods ---

  playNote(radius: number, velocity?: number): number | undefined {
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    const isMotor = radius >= 58;

    if (isMotor) {
      this.playKickDrum();
    } else {
      const drumFrequency = this.mapRadiusToDrumFrequency(radius);
      this.playTomDrum(drumFrequency);
    }

    return 1;
  }

  private mapRadiusToDrumFrequency(radius: number): number {
    const minRadius = 25;
    const maxRadius = 60;
    const minFreq = 60;
    const maxFreq = 150;
    const normalized = (radius - minRadius) / (maxRadius - minRadius);
    const freq = maxFreq - (normalized * (maxFreq - minFreq));
    return freq;
  }

  private playKickDrum() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const decay = 0.3 + (this.turbulence * 0.4);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);

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
    const decay = 0.2 + (this.turbulence * 0.3);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.8, now + 0.1);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + decay);
  }

  stopNote() {
    // Percussion doesn't need stop
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
