import { engineRegistry } from '../EngineRegistry';
import { GearheartEngine } from './GearheartEngine';

// Parameter labels for Gearheart
const PARAM_LABELS = {
    pressure: "ROZAMENTO",
    resonance: "REVERBERACIÓN",
    viscosity: "LUBRICACIÓN",
    turbulence: "VELOCIDADE",
    diffusion: "DIFUSIÓN METÁLICA"
};

// Theme for Gearheart
const THEME = {
    bg: 'bg-[#151210]',
    text: 'text-[#d4c5a9]',
    accent: 'text-[#ffbf69]',
    border: 'border-[#b08d55]/30'
};

// Register the engine
engineRegistry.register({
    name: 'gearheart',
    displayName: 'Gearheart Forge',
    factory: () => new GearheartEngine(),
    paramLabels: PARAM_LABELS,
    theme: THEME
});
