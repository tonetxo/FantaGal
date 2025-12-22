
export interface SynthState {
  pressure: number;
  resonance: number;
  viscosity: number;
  turbulence: number;
  diffusion: number;
  isAudioActive: boolean;
}

export interface PlanetaryCondition {
  stormLevel: number;
  temperature: number;
  methaneDensity: number;
  description: string;
}

export enum ParameterType {
  PRESSURE = 'pressure',
  RESONANCE = 'resonance',
  VISCOSITY = 'viscosity',
  TURBULENCE = 'turbulence',
  DIFFUSION = 'diffusion'
}
