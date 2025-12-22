
import { SynthState } from '../types';
import { ISynthEngine } from './BaseSynthEngine';
import { CriosferaEngine } from './engines/CriosferaEngine';

class SynthManager {
  private activeEngine: ISynthEngine;
  private engines: Map<string, ISynthEngine>;

  constructor() {
    this.engines = new Map();
    // Instanciar motores
    const criosfera = new CriosferaEngine();
    this.engines.set('criosfera', criosfera);
    
    // Set default
    this.activeEngine = criosfera;
  }

  async init() {
    await this.activeEngine.init();
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
    await this.activeEngine.resume();
  }

  // Método para cambiar de motor no futuro
  switchEngine(engineName: string) {
    const engine = this.engines.get(engineName);
    if (engine) {
      // Idealmente, aquí fariamos un crossfade ou stopAll
      this.activeEngine = engine;
    }
  }
}

export const synthManager = new SynthManager();
