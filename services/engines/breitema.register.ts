import { engineRegistry } from '../EngineRegistry';
import { BreitemaEngine } from './BreitemaEngine';

// Parameter labels for Brétema Grid
const PARAM_LABELS = {
    pressure: "TEMPO",
    resonance: "PROFUNDIDADE FM",
    viscosity: "DENSIDADE BRÉTEMA",
    turbulence: "MOVEMENTO NÉBOA",
    diffusion: "REVERBERACIÓN"
};

// Theme for Brétema - VHS/Vapor aesthetic
const THEME = {
    bg: 'bg-[#0f1318]',
    text: 'text-[#9faab8]',
    accent: 'text-[#8be9fd]',
    border: 'border-[#44475a]/40'
};

// Register the engine
engineRegistry.register({
    name: 'breitema',
    displayName: 'Reixa da Brétema',
    factory: () => new BreitemaEngine(),
    paramLabels: PARAM_LABELS,
    theme: THEME
});
