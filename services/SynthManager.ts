import { ISynthEngine } from './BaseSynthEngine';
import { SynthState } from '../types';
import { engineRegistry } from './EngineRegistry';
import { GearheartEngine } from './engines/GearheartEngine';
import { EchoVesselEngine } from './engines/EchoVesselEngine';

// Import engine registrations to ensure they're registered
import './engines';

class SynthManager {
  private activeEngineName: string = 'criosfera';
  private engines: Map<string, ISynthEngine> = new Map();
  private ctx: AudioContext | null = null;

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

        // Initialize if AudioContext already exists
        if (this.ctx) {
          engine.init(this.ctx);
        }
      } else {
        console.warn(`Engine "${name}" not found in registry`);
      }
    }
    return engine;
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Only create and initialize the active engine
    this.getOrCreateEngine(this.activeEngineName);
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
    this.activeEngineName = engineName;
  }

  /**
   * Get typed access to Gearheart engine (for engine-specific methods)
   */
  getGearheartEngine(): GearheartEngine | undefined {
    return this.engines.get('gearheart') as GearheartEngine | undefined;
  }

  /**
   * Get typed access to EchoVessel engine (for engine-specific methods)
   */
  getEchoVesselEngine(): EchoVesselEngine | undefined {
    return this.engines.get('echo-vessel') as EchoVesselEngine | undefined;
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
   * Reset AudioContext to force Android out of communication mode
   * This recreates the audio context and re-initializes all engines
   */
  async resetAudioContext() {
    if (!this.ctx) return;

    // Close the old context
    await this.ctx.close();

    // Create a new context
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Re-initialize all existing engines with the new context
    const oldEngines = Array.from(this.engines.keys());
    this.engines.clear();

    for (const engineName of oldEngines) {
      this.getOrCreateEngine(engineName);
    }

    console.log("AudioContext reset completed");
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }
}

export const synthManager = new SynthManager();