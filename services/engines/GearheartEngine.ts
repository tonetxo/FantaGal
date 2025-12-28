import { SynthState } from '../../types';
import { AbstractSynthEngine } from '../AbstractSynthEngine';
import { makeDistortionCurve, createReverbImpulse, createNoiseBuffer } from '../audioUtils';

// Physics constants
const GEAR_CONNECTION_MARGIN_PX = 18;        // Margin for gear connection detection
const MAX_PROPAGATION_ITERATIONS = 30;       // Max iterations for energy propagation
const DISCONNECTED_GEAR_DEPTH = 999;         // Depth value for disconnected gears

// Audio constants
const KICK_BASE_DECAY = 0.4;                 // Base decay time for kick drum
const KICK_START_FREQUENCY_HZ = 55;          // Starting frequency for kick sub-bass
const KICK_END_FREQUENCY_HZ = 30;            // Ending frequency for kick sub-bass
const MOTOR_BASE_SPEED = 0.02;               // Base rotation speed for the motor gear

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
  lastRotation: number; // For robust trigger detection
  depth: number; // Distance from motor (0 = motor, 1 = connected to motor, etc.)
}

export class GearheartEngine extends AbstractSynthEngine {
  // Reverb
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;

  // Percussion chain
  private percussionFilter: BiquadFilterNode | null = null;
  private distortion: WaveShaperNode | null = null;

  // Audio output tap for vocoder carrier
  private outputTap: GainNode | null = null;

  // Physics & Sequencer State
  private gears: Gear[] = [];
  private animationFrameId: number | null = null;

  // State from React (mirrored here for physics)
  private speedMultiplier: number = 1;
  private turbulence: number = 0.5;
  public vibration: number = 0; // Exposed for UI

  // Motor State
  public isMotorActive: boolean = true;

  constructor() {
    super();
  }

  // Use custom audio routing
  protected useDefaultRouting(): boolean {
    return false;
  }

  // --- Audio Setup ---

  protected initializeEngine(): void {
    this.setupAudioNodes();
    // Initialize gears but DON'T start physics loop
    // Physics loop is started only when user activates the engine via toggleEngine()
    this.initGears();
  }

  /**
   * Reinitialize only audio nodes without resetting gear state.
   * Called when AudioContext is recreated to restore volume on Android.
   */
  protected onContextReinit(): void {
    this.setupAudioNodes();
    // Don't call initGears() - preserve existing gear configuration
    // Physics loop should continue running if it was
  }

  /**
   * Setup audio nodes (shared between init and reinit)
   */
  private setupAudioNodes(): void {
    const ctx = this.getContext();
    const masterGain = this.getMasterGain();
    if (!ctx || !masterGain) return;

    // Set custom master gain - balanced for mix
    masterGain.gain.value = 2.0; // Was 4.0, reduced to avoid limiter pumping

    // NOTE: No internal compressor - we use the global masterLimiter only

    // Reverb Setup
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.buildImpulse();
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0;

    // Percussion Filter - high cutoff to preserve brightness
    this.percussionFilter = ctx.createBiquadFilter();
    this.percussionFilter.type = 'lowpass';
    this.percussionFilter.frequency.value = 8000; // Was 2000
    this.percussionFilter.Q.value = 0.7; // Was 2

    // Distortion for percussive sound
    this.distortion = ctx.createWaveShaper();
    this.distortion.curve = makeDistortionCurve(0.05);

    // Simplified routing: masterGain -> percussionFilter -> masterBus
    // (skip distortion to preserve volume)
    masterGain.connect(this.percussionFilter);

    // Connect directly to masterBus
    if (this.masterBus) {
      this.percussionFilter.connect(this.masterBus);
    } else {
      this.percussionFilter.connect(ctx.destination);
    }

    this.percussionFilter.connect(this.reverb);       // Wet Send
    this.reverb.connect(this.reverbGain);
    if (this.masterBus) {
      this.reverbGain.connect(this.masterBus);
    } else {
      this.reverbGain.connect(ctx.destination);
    }

    // Create output tap for vocoder
    this.outputTap = ctx.createGain();
    this.outputTap.gain.value = 1.0;
    masterGain.connect(this.outputTap);
  }

  private buildImpulse(): AudioBuffer | null {
    if (!this.ctx) return null;
    return createReverbImpulse(this.ctx, 2.0, 4);
  }

  // --- Physics Engine ---

  public initGears() {
    // Default initial gears
    const width = typeof window !== 'undefined' ? window.innerWidth : 800;
    const height = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600;
    const centerX = width / 2;

    this.gears = [
      { id: 0, x: 150, y: 300, radius: 60, teeth: 12, angle: 0, speed: 0.02, isDragging: false, isConnected: true, material: 'iron', lastRotation: 0, depth: 0 }, // Motor
      { id: 1, x: 300, y: 200, radius: 40, teeth: 8, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'bronze', lastRotation: 0, depth: 999 },
      { id: 2, x: 100, y: 150, radius: 30, teeth: 6, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'copper', lastRotation: 0, depth: 999 },
      { id: 3, x: 250, y: 400, radius: 50, teeth: 10, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'gold', lastRotation: 0, depth: 999 },
      { id: 4, x: 200, y: 100, radius: 25, teeth: 5, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'platinum', lastRotation: 0, depth: 999 },
    ];
  }

  private lastConfig: string = '';

  public setGearConfig(gearConfig: { numGears: number; arrangement: string } | null) {
    if (!gearConfig) return;

    // Create a fingerprint of the config to prevent unnecessary resets
    const configFingerprint = `${gearConfig.numGears}-${gearConfig.arrangement}`;
    if (this.lastConfig === configFingerprint && this.gears.length > 0) {
      return; // Already configured, keep state
    }
    this.lastConfig = configFingerprint;

    const newGears: Gear[] = [];
    const width = window.innerWidth;
    const height = window.innerHeight * 0.6;
    const centerX = width / 2;

    // Motor at bottom center
    const motorX = centerX;
    const motorY = height - 100;
    const motorRadius = 60;

    newGears.push({
      id: 0,
      x: motorX,
      y: motorY,
      radius: motorRadius,
      teeth: 12,
      angle: 0,
      speed: 0.02,
      isDragging: false,
      isConnected: true,
      material: 'iron',
      lastRotation: 0,
      depth: 0
    });

    const count = Math.max(3, Math.min(8, gearConfig.numGears));
    const materials: ('bronze' | 'copper' | 'gold' | 'platinum')[] = ['bronze', 'copper', 'gold', 'platinum'];

    // Position gears in a chain - each touching the previous one
    let lastX = motorX;
    let lastY = motorY;
    let lastRadius = motorRadius;
    let direction = -1; // Start going up

    for (let i = 1; i < count; i++) {
      const r = 25 + Math.random() * 25;
      const spacing = lastRadius + r + 5; // Slight overlap for guaranteed connection

      let x, y;
      if (gearConfig.arrangement === 'linear') {
        // Horizontal chain from motor
        x = lastX + spacing * Math.sign(i % 2 === 1 ? 1 : -1) * (Math.ceil(i / 2));
        y = lastY - spacing * 0.3;
      } else if (gearConfig.arrangement === 'cluster') {
        // Spiral around motor
        const angle = (Math.PI * 0.6 * i) - Math.PI / 2;
        x = motorX + Math.cos(angle) * (spacing * 0.8 * i);
        y = motorY + Math.sin(angle) * (spacing * 0.8 * i);
      } else {
        // Vertical chain going up from motor
        x = lastX + (Math.random() - 0.5) * 40;
        y = lastY - spacing * 0.9;
      }

      // Clamp within bounds
      x = Math.max(r + 10, Math.min(width - r - 10, x));
      y = Math.max(r + 10, Math.min(height - r - 10, y));

      newGears.push({
        id: i,
        x: x,
        y: y,
        radius: r,
        teeth: Math.floor(r / 5),
        angle: 0,
        speed: 0,
        isDragging: false,
        isConnected: true,
        material: materials[i % materials.length],
        lastRotation: 0,
        depth: 999
      });

      lastX = x;
      lastY = y;
      lastRadius = r;
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
    gears[0].speed = this.isMotorActive ? MOTOR_BASE_SPEED * this.speedMultiplier : 0;
    gears[0].depth = 0; // Motor is always root

    // Reset non-motors/non-connected
    for (let i = 1; i < gears.length; i++) {
      if (gears[i].isDragging) {
        gears[i].isConnected = false;
        gears[i].speed = 0;
        gears[i].depth = DISCONNECTED_GEAR_DEPTH;
      } else {
        gears[i].isConnected = false;
        gears[i].speed = 0;
        gears[i].depth = DISCONNECTED_GEAR_DEPTH;
      }
    }

    // Energy Propagation (Iterative Flood Fill)
    let changed = true;
    let iterations = 0;
    // Increase iterations to ensure propatagion in complex chains
    while (changed && iterations < MAX_PROPAGATION_ITERATIONS) {
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
          const margin = GEAR_CONNECTION_MARGIN_PX;

          if (dist < combinedRadius + margin) {
            gears[j].isConnected = true;
            gears[j].speed = -gears[i].speed * (gears[i].radius / gears[j].radius);
            gears[j].depth = gears[i].depth + 1; // Propagate depth
            changed = true;
          }
        }
      }
    }

    // Update Angles and Trigger Sound
    gears.forEach(g => {
      if (g.isConnected) {
        g.angle += g.speed; // Restore angular movement!
        const currentRotation = Math.floor(g.angle / (Math.PI * 2));

        // Check for full rotation change
        if (currentRotation !== g.lastRotation) {
          // INTERNAL AUDIO TRIGGER
          this.internalTrigger(g.radius, g.id);
          g.lastRotation = currentRotation;
        }
      }
    });
  }

  private internalTrigger(radius: number, id: number) {
    // Play sound
    this.playNote(radius, undefined, id);

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

    // Audio Params - significantly boosted for noticeable effect
    const t = this.ctx.currentTime;

    // Pressure (Rozamento/Complejidad): affects volume and filter dramatically
    // Volume range: 0.25 - 0.8 (wider range)
    this.masterGain.gain.setTargetAtTime(0.25 + (state.pressure * 0.55), t, 0.1);
    // Filter cutoff: 400 - 6000 Hz (starts darker, opens up more)
    this.percussionFilter.frequency.setTargetAtTime(400 + (state.pressure * 5600), t, 0.1);

    // Resonance: Q range 0.7 - 12 (reduced from 20 to avoid extreme kick variations)
    this.percussionFilter.Q.setTargetAtTime(0.7 + (state.resonance * 11.3), t, 0.1);

    if (this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(state.diffusion * 1.5, t, 0.1);
    }
  }

  // --- Audio Methods ---

  playNote(radius: number, velocity?: number, gearId?: number): number | undefined {
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    // Find the gear to check its material
    const gear = this.gears.find(g => g.id === gearId);

    const isMotor = radius >= 58;
    const isHiHat = gear?.material === 'platinum';
    const isBrushSnare = gear?.material === 'gold';

    if (isMotor) {
      this.playKickDrum();
    } else {
      // Attenuate volume based on depth (distance from motor)
      // Gain = 0.2 + (0.8 * (0.85 ^ depth))
      // Ensures it never goes below 0.2, but drops significantly with distance
      const depth = gear ? gear.depth : 0;
      const attenuation = Math.max(0.2, Math.pow(0.85, depth));

      if (isHiHat) {
        this.playClosedHiHat(attenuation);
      } else if (isBrushSnare) {
        this.playBrushSnare(attenuation);
      } else {
        const drumFrequency = this.mapRadiusToDrumFrequency(radius);
        this.playTomDrum(drumFrequency, attenuation);
      }
    }

    return 1;
  }

  private playClosedHiHat(volume: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const duration = 0.05;

    // Use shared noise buffer utility
    const buffer = createNoiseBuffer(this.ctx, duration);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(10000, now); // Subido de 7000 a 10000 para hacerlo más agudo
    filter.Q.setValueAtTime(1, now);

    const env = this.ctx.createGain();
    // Start from 0 and ramp up to avoid click
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1.0 * volume, now + 0.003); // Was 2.0, reduced
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
  }

  private playBrushSnare(volume: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const duration = 0.15;

    // Noise component (the "brush" stroke) - using shared utility
    const buffer = createNoiseBuffer(this.ctx, duration);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2500, now);
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseEnv = this.ctx.createGain();
    noiseEnv.gain.setValueAtTime(0, now);
    noiseEnv.gain.linearRampToValueAtTime(0.2 * volume, now + 0.02); // Was 0.4, reduced
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Body component (tonal part of the snare) - Shortened to a snap
    const bodyOsc = this.ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(250, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(220, now + 0.05); // Faster drop, higher end frequency

    const bodyEnv = this.ctx.createGain();
    bodyEnv.gain.setValueAtTime(0, now);
    bodyEnv.gain.linearRampToValueAtTime(0.15 * volume, now + 0.003); // Was 0.3, reduced
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05); // Shortened duration to 0.05s

    // High pass filter to ensure no unwanted low frequency remains
    const bodyHighPass = this.ctx.createBiquadFilter();
    bodyHighPass.type = 'highpass';
    bodyHighPass.frequency.setValueAtTime(200, now);

    // Connections
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(this.masterGain);

    bodyOsc.connect(bodyHighPass);
    bodyHighPass.connect(bodyEnv);
    bodyEnv.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.05); // Shortened to 0.05s
  }

  private mapRadiusToDrumFrequency(radius: number): number {
    // Extended musical scale (A1 to A4) alternating between fourths and fifths
    // A1=55, D2=73.4 (4th), A2=110 (5th), D3=146.8 (4th), A3=220 (5th), D4=293.6 (4th), A4=440 (5th)
    // Plus intermediate notes to reach 15 steps for better differentiation
    const notes = [
      55.00,  // A1
      65.41,  // C2
      73.42,  // D2
      82.41,  // E2
      98.00,  // G2
      110.00, // A2 (5th from D2)
      130.81, // C3
      146.83, // D3 (4th from A2)
      164.81, // E3
      196.00, // G3
      220.00, // A3 (5th from D3)
      261.63, // C4
      293.66, // D4 (4th from A3)
      329.63, // E4
      440.00  // A4 (5th from D4 approx)
    ];

    const minRadius = 20;
    const maxRadius = 60;

    // Clamp radius
    const r = Math.max(minRadius, Math.min(maxRadius, radius));

    // Normalize to 0-1 (inverted so small = high)
    const normalized = 1 - ((r - minRadius) / (maxRadius - minRadius));

    // Select note based on normalized value with 15 steps
    const noteIndex = Math.floor(normalized * (notes.length - 1));
    return notes[Math.min(noteIndex, notes.length - 1)];
  }

  private playKickDrum() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const decay = KICK_BASE_DECAY + (this.turbulence * 0.3);

    // Sub-bass oscillator for deep kick
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(KICK_START_FREQUENCY_HZ, now);
    subOsc.frequency.exponentialRampToValueAtTime(KICK_END_FREQUENCY_HZ, now + 0.15);

    // Click/attack transient
    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(150, now);
    clickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.03);

    // Sub envelope - balanced volume for clean mix
    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0, now);
    subEnv.gain.linearRampToValueAtTime(4.0, now + 0.003); // Was 8.0, reduced
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + decay);

    // Click envelope - balanced volume
    const clickEnv = this.ctx.createGain();
    clickEnv.gain.setValueAtTime(0, now);
    clickEnv.gain.linearRampToValueAtTime(2.5, now + 0.002); // Was 5.0, reduced
    clickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    // Connect through masterGain (original routing)
    subOsc.connect(subEnv);
    clickOsc.connect(clickEnv);
    subEnv.connect(this.masterGain);
    clickEnv.connect(this.masterGain);

    subOsc.start(now);
    clickOsc.start(now);
    subOsc.stop(now + decay);
    clickOsc.stop(now + 0.05);
  }

  private playTomDrum(frequency: number, volume: number = 1.0) {
    const ctx = this.getContext();
    const masterGain = this.getMasterGain();
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;

    // Longer decay for lower frequencies, shorter for higher
    const baseDec = frequency < 150 ? 0.4 : 0.25;
    const decay = baseDec + (this.turbulence * 0.2);

    // Main tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.75, now + 0.1);

    // Dynamic volume: progressively lower for higher frequencies
    // This provides a natural balance where bass is felt more than treble
    // Dynamic volume: steep drop for higher frequencies
    // This makes small toms much quieter as requested
    const freqFactor = Math.max(0, 1 - (frequency / 500));
    const baseVol = 1.0 + (freqFactor * 2.0); // Was 0.3 + 1.0; now ranges from 1.0 to 3.0

    // Main envelope - start from 0 to avoid click
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(baseVol * volume, now + 0.003); // 3ms ramp
    env.gain.exponentialRampToValueAtTime(0.001, now + decay);

    // Connect
    osc.connect(env);
    env.connect(masterGain);

    osc.start(now);
    osc.stop(now + decay);
  }

  stopNote() {
    // No-op, as we use trigger-based percussion
  }

  /**
   * Get audio output tap for vocoder carrier
   */
  public getOutputTap(): GainNode | null {
    return this.outputTap;
  }
}
