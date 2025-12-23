import { CriosferaEngine } from './engines/CriosferaEngine';
import { GearheartEngine } from './engines/GearheartEngine';
import { EchoVesselEngine } from './engines/EchoVesselEngine';

class SynthManager {
  private activeEngine: ISynthEngine;
  private engines: Map<string, ISynthEngine>;
  private ctx: AudioContext | null = null;

  constructor() {
    this.engines = new Map();
    const criosfera = new CriosferaEngine();
    const gearheart = new GearheartEngine();
    const echoVessel = new EchoVesselEngine();
    
    this.engines.set('criosfera', criosfera);
    this.engines.set('gearheart', gearheart);
    this.engines.set('echo-vessel', echoVessel);
    
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

  getGearheartEngine(): GearheartEngine | undefined {
    return this.engines.get('gearheart') as GearheartEngine;
  }
  
  getEchoVesselEngine(): EchoVesselEngine | undefined {
    return this.engines.get('echo-vessel') as EchoVesselEngine;
  }
}

export const synthManager = new SynthManager();