
import { SynthState } from '../types';

export interface ISynthEngine {
  init(): Promise<void>;
  updateParameters(state: SynthState): void;
  playNote(frequency: number, velocity?: number): number | undefined;
  stopNote(id: number): void;
  resume(): Promise<void>;
}
