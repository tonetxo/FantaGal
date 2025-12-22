import { SynthState } from '../types';
import { ISynthEngine } from './BaseSynthEngine';
import { CriosferaEngine } from './engines/CriosferaEngine';
import { GearheartEngine } from './engines/GearheartEngine';

class SynthManager {
  private activeEngine: ISynthEngine;
  private engines: Map<string, ISynthEngine>;
  private ctx: AudioContext | null = null;

  constructor() {
    this.engines = new Map();
    const criosfera = new CriosferaEngine();
    const gearheart = new GearheartEngine();
    
    this.engines.set('criosfera', criosfera);
    this.engines.set('gearheart', gearheart);
    
    this.activeEngine = criosfera;
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Inicializamos todos os motores co MESMO contexto
    for (const engine of this.engines.values()) {
      engine.init(this.ctx);
    }
  }

  updateParameters(state: SynthState) {
    this.activeEngine.updateParameters(state);
  }

  playNote(frequency: number, velocity?: number) {
    return this.activeEngine.playNote(frequency, velocity);
  }

  stopNote(id: number) {
    this.activeEngine.stopNote(id);
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  switchEngine(engineName: string) {
    const engine = this.engines.get(engineName);
    if (engine) {
      this.activeEngine = engine;
    }
  }
}

export const synthManager = new SynthManager();