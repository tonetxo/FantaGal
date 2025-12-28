import { SynthState } from '../types';

export interface ISynthEngine {
  init(ctx: AudioContext, masterBus?: GainNode): void; // Agora recibe o contexto e opcionalmente un bus maestro
  updateParameters(state: SynthState): void;
  playNote(frequency: number, velocity?: number): number | undefined;
  stopNote(id: number): void;
  resume(): Promise<void>;
  /** Optional cleanup method called when engine is deactivated */
  reset?(): void;
}