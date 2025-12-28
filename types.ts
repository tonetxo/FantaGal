
export interface SynthState {
  pressure: number;
  resonance: number;
  viscosity: number;
  turbulence: number;
  diffusion: number;
}

/** Tipo central para nombres de motores */
export type EngineName = 'criosfera' | 'gearheart' | 'echo-vessel' | 'vocoder' | 'breitema';

export interface PlanetaryCondition {
  stormLevel: number;
  temperature: number;
  methaneDensity: number;
  description: string;
  gearConfig?: {
    numGears: number;
    arrangement: 'linear' | 'cluster' | 'chaotic';
  };
}

export enum ParameterType {
  PRESSURE = 'pressure',
  RESONANCE = 'resonance',
  VISCOSITY = 'viscosity',
  TURBULENCE = 'turbulence',
  DIFFUSION = 'diffusion'
}
