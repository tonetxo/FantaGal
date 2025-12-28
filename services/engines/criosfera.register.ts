import { engineRegistry } from '../EngineRegistry';
import { CriosferaEngine } from './CriosferaEngine';

// Parameter labels for Criosfera
const PARAM_LABELS = {
    pressure: "PRESIÓN",
    resonance: "RESONANCIA",
    viscosity: "VISCOSIDADE",
    turbulence: "TORMENTA",
    diffusion: "DIFUSIÓN"
};

// Theme for Criosfera
const THEME = {
    bg: 'bg-stone-950',
    text: 'text-stone-100',
    accent: 'text-orange-500',
    border: 'border-stone-800'
};

// Register the engine
engineRegistry.register({
    name: 'criosfera',
    displayName: 'Criosfera Armónica',
    factory: () => new CriosferaEngine(),
    paramLabels: PARAM_LABELS,
    theme: THEME
});
