import { ISynthEngine } from './BaseSynthEngine';
import { SynthState } from '../types';
import { engineRegistry } from './EngineRegistry';
import { GearheartEngine } from './engines/GearheartEngine';
import { EchoVesselEngine } from './engines/EchoVesselEngine';
import { VocoderEngine } from './engines/VocoderEngine';

// Import engine registrations to ensure they're registered
import './engines';

class SynthManager {
  private activeEngineName: string = 'criosfera';
  private engines: Map<string, ISynthEngine> = new Map();
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;

  constructor() {
    // Don't create any engines in constructor - lazy creation only
  }

  /**
   * Gets or creates an engine by name using the registry (lazy creation)
   */
  private getOrCreateEngine(name: string): ISynthEngine | undefined {
    let engine = this.engines.get(name);
    if (!engine) {
      // Create engine using the registry
      engine = engineRegistry.createEngine(name);
      if (engine) {
        this.engines.set(name, engine);
      } else {
        console.warn(`Engine "${name}" not found in registry`);
      }
    }

    // Always ensure engine is initialized if context exists
    // (init() has early return if already initialized, so this is safe)
    if (engine && this.ctx) {
      engine.init(this.ctx, this.masterGain || undefined);
    }

    return engine;
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
    }

    this.setupMasterBus();

    // Only create and initialize the active engine
    this.getOrCreateEngine(this.activeEngineName);
  }

  private setupMasterBus() {
    if (!this.ctx) return;

    // Create master nodes on the CURRENT context
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8; // Safe default headroom

    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -3.0; // Was -1.0, more headroom to avoid clicks
    this.masterLimiter.knee.value = 15; // Was 10, softer knee
    this.masterLimiter.ratio.value = 12; // Was 20, gentler compression
    this.masterLimiter.attack.value = 0.005; // Was 0.002, slower attack to avoid clicks
    this.masterLimiter.release.value = 0.2; // Was 0.1, smoother release

    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.ctx.destination);
  }

  updateParameters(state: SynthState) {
    const engine = this.engines.get(this.activeEngineName);
    if (engine) {
      engine.updateParameters(state);
    }
  }

  playNote(frequency: number, velocity?: number) {
    const engine = this.engines.get(this.activeEngineName);
    if (engine) {
      return engine.playNote(frequency, velocity);
    }
    return undefined;
  }

  stopNote(id: number) {
    const engine = this.engines.get(this.activeEngineName);
    if (engine) {
      engine.stopNote(id);
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  switchEngine(engineName: string) {
    // Validate that engine exists in registry
    if (!engineRegistry.has(engineName)) {
      console.warn(`Cannot switch to unknown engine: ${engineName}`);
      return;
    }

    // We no longer reset the previous engine automatically.
    // The principle is that all engines keep sounding unless stopped explicitly.
    this.activeEngineName = engineName;

    // NOTE: Engine creation is now lazy - it happens when UI requests the engine
    // This avoids lag during switch navigation
  }

  /**
   * Get typed access to Gearheart engine (for engine-specific methods)
   */
  getGearheartEngine(): GearheartEngine | undefined {
    // Ensure the engine is created if it doesn't exist yet
    this.getOrCreateEngine('gearheart');
    return this.engines.get('gearheart') as GearheartEngine | undefined;
  }

  /**
   * Get typed access to EchoVessel engine (for engine-specific methods)
   */
  getEchoVesselEngine(): EchoVesselEngine | undefined {
    return this.engines.get('echo-vessel') as EchoVesselEngine | undefined;
  }

  /**
   * Get typed access to Vocoder engine (for engine-specific methods)
   */
  getVocoderEngine(): VocoderEngine | undefined {
    const engine = this.engines.get('vocoder');
    if (engine) {
      return engine as VocoderEngine;
    }
    // If not yet created, create it first
    this.getOrCreateEngine('vocoder');
    return this.engines.get('vocoder') as VocoderEngine | undefined;
  }

  /**
   * Get an engine by name (for external access without type casting)
   */
  getEngine(name: string): ISynthEngine | undefined {
    return this.engines.get(name);
  }

  getCurrentEngineName(): string {
    return this.activeEngineName;
  }

  /**
   * Get all registered engine names
   */
  getAvailableEngines(): string[] {
    return engineRegistry.getNames();
  }

  /**
   * Get audio output tap from an engine (for use as carrier source in vocoder)
   * Returns null if engine doesn't exist or doesn't support output tap
   */
  getEngineTap(engineName: string): GainNode | null {
    const engine = this.engines.get(engineName);
    if (!engine) return null;

    // Check if engine has getOutputTap method
    if (typeof (engine as any).getOutputTap === 'function') {
      return (engine as any).getOutputTap() || null;
    }
    return null;
  }

  /**
   * Stop the currently active engine
   */
  stopActiveEngine() {
    const engine = this.engines.get(this.activeEngineName);
    if (engine) {
      // For Gearheart engine, stop the physics loop
      if (this.activeEngineName === 'gearheart') {
        const gearEngine = engine as any; // Type assertion since we know it's GearheartEngine
        if (gearEngine.stopPhysicsLoop) {
          gearEngine.stopPhysicsLoop();
        }
      }
      // For Echo Vessel engine, disable mic
      if (this.activeEngineName === 'echo-vessel') {
        const echoEngine = engine as any;
        if (echoEngine.setMicEnabled) {
          echoEngine.setMicEnabled(false);
        }
      }
      // For Vocoder engine, disable mic
      if (this.activeEngineName === 'vocoder') {
        const vocoderEngine = engine as any;
        if (vocoderEngine.setMicEnabled) {
          vocoderEngine.setMicEnabled(false);
        }
      }
    }
  }

  /**
   * Reset AudioContext to force Android out of communication mode
   * This recreates the audio context and re-initializes all engines
   */
  async resetAudioContext() {
    if (!this.ctx) return;

    // Close the old context
    await this.ctx.close();

    // Create a new context
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // RECREATE master bus on the new context
    this.setupMasterBus();

    // Re-initialize all existing engines with the new context
    const oldEngines = Array.from(this.engines.keys());
    this.engines.clear();

    for (const engineName of oldEngines) {
      this.getOrCreateEngine(engineName);
    }
  }



  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Get the global master bus for all engines to connect to.
   * This ensures centralized volume control and limiting.
   */
  getMasterBus(): GainNode | null {
    return this.masterGain;
  }
}

export const synthManager = new SynthManager();