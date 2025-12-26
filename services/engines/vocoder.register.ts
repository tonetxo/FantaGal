import { engineRegistry } from '../EngineRegistry';
import { VocoderEngine } from './VocoderEngine';

// Parameter labels for Vocoder das Covas
const PARAM_LABELS = {
    pressure: "HUMIDADE DAS COVAS",
    resonance: "RESONANCIA CRISTALINA",
    viscosity: "MESTURA PORTADORAS",       // NEW: Carrier balance control!
    turbulence: "DESPLAZAMENTO FORMANTE",
    diffusion: "PROFUNDIDADE CAVERNA"
};

// Theme for Vocoder (cave/neon aesthetic)
const THEME = {
    bg: 'bg-[#0d1117]',
    text: 'text-emerald-100',
    accent: 'text-emerald-400',
    border: 'border-emerald-900/30'
};

// Register the engine
engineRegistry.register({
    name: 'vocoder',
    displayName: 'Vocoder das Covas',
    factory: () => new VocoderEngine(),
    paramLabels: PARAM_LABELS,
    theme: THEME
});
