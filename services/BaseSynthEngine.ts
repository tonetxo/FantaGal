import { SynthState } from '../types';

export interface ISynthEngine {
  init(ctx: AudioContext): void; // Agora recibe o contexto
  updateParameters(state: SynthState): void;
  playNote(frequency: number, velocity?: number): number | undefined;
  stopNote(id: number): void;
  resume(): Promise<void>;
  /** Optional cleanup method called when engine is deactivated */
  reset?(): void;
}