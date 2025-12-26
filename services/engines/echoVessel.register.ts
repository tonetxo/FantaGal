import { engineRegistry } from '../EngineRegistry';
import { EchoVesselEngine } from './EchoVesselEngine';

// Parameter labels for Echo Vessel (neutral vial)
const PARAM_LABELS_NEUTRAL = {
    pressure: "RESONANCIA INTERNA",
    resonance: "ECO PROFUNDO",
    viscosity: "FLUIDEZ VOCAL",
    turbulence: "—",
    diffusion: "ESPACIALIDADE"
};

// Parameter labels for Mercury vial
const PARAM_LABELS_MERCURY = {
    pressure: "MODULACIÓN FREQ",
    resonance: "PROFUNDIDADE RING",
    viscosity: "VELOCIDADE MOD",
    turbulence: "—",
    diffusion: "ESPACIALIDADE"
};

// Parameter labels for Amber vial
const PARAM_LABELS_AMBER = {
    pressure: "FEEDBACK DELAY",
    resonance: "SATURACIÓN",
    viscosity: "TEMPO DELAY",
    turbulence: "—",
    diffusion: "ESPACIALIDADE"
};

// Theme for Echo Vessel
const THEME = {
    bg: 'bg-[#0a0f14]',
    text: 'text-slate-200',
    accent: 'text-cyan-500',
    border: 'border-cyan-900/30'
};

// Register the engine
engineRegistry.register({
    name: 'echo-vessel',
    displayName: 'Echo Vessel',
    factory: () => new EchoVesselEngine(),
    paramLabels: PARAM_LABELS_NEUTRAL,
    theme: THEME
});

// Export vial-specific labels for use in the UI
export const ECHO_VESSEL_VIAL_LABELS = {
    neutral: PARAM_LABELS_NEUTRAL,
    mercury: PARAM_LABELS_MERCURY,
    amber: PARAM_LABELS_AMBER
};
