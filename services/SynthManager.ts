import { CriosferaEngine } from './engines/CriosferaEngine';
import { GearheartEngine } from './engines/GearheartEngine';
import { EchoVesselEngine } from './engines/EchoVesselEngine';
import { ISynthEngine } from './BaseSynthEngine';
import { SynthState } from '../types';

type EngineName = 'criosfera' | 'gearheart' | 'echo-vessel';

class SynthManager {
  private activeEngineName: EngineName = 'criosfera';
  private engines: Map<EngineName, ISynthEngine> = new Map();
  private ctx: AudioContext | null = null;

  constructor() {
    // Don't create any engines in constructor - lazy creation only
  }

  /**
   * Gets or creates an engine by name (lazy creation)
   */
  private getOrCreateEngine(name: EngineName): ISynthEngine {
    let engine = this.engines.get(name);
    if (!engine) {
      // Create engine on demand
      switch (name) {
        case 'criosfera':
          engine = new CriosferaEngine();
          break;
        case 'gearheart':
          engine = new GearheartEngine();
          break;
        case 'echo-vessel':
          engine = new EchoVesselEngine();
          break;
      }
      this.engines.set(name, engine);

      // Initialize if AudioContext already exists
      if (this.ctx) {
        engine.init(this.ctx);
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

  switchEngine(engineName: EngineName) {
    // Only change the active engine name - never create engines here
    // Engines are only created when init() is called
    this.activeEngineName = engineName;
  }

  getGearheartEngine(): GearheartEngine | undefined {
    // Only return if already created, don't create on access
    return this.engines.get('gearheart') as GearheartEngine | undefined;
  }

  getEchoVesselEngine(): EchoVesselEngine | undefined {
    // Only return if already created, don't create on access
    return this.engines.get('echo-vessel') as EchoVesselEngine | undefined;
  }

  getCurrentEngineName(): EngineName {
    return this.activeEngineName;
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
    // We need to clear and recreate them since they hold references to old nodes
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