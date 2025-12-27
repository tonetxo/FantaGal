import React from 'react';
import { ParameterType, SynthState } from '../types';
import ControlSlider from './ControlSlider';

interface Theme {
  bg: string;
  text: string;
  accent: string;
  border: string;
}

interface ControlsPanelProps {
  currentEngine: 'criosfera' | 'gearheart' | 'echo-vessel' | 'vocoder' | 'breitema';
  theme: Theme;
  state: SynthState;
  isActive: boolean;
  updateParam: (param: ParameterType, value: number) => void;
  labels: Record<string, string>;
  aiPrompt: string;
  setAiPrompt: (val: string) => void;
  apiKey: string;
  generateAIPatch: () => void;
  isAiLoading: boolean;
  titanReport: string;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

const ControlsPanel = ({
  currentEngine,
  theme,
  state,
  isActive,
  updateParam,
  labels,
  aiPrompt,
  setAiPrompt,
  apiKey,
  generateAIPatch,
  isAiLoading,
  titanReport,
  setIsSettingsOpen
}: ControlsPanelProps) => (
  <div className="flex flex-col h-full pt-4 md:pt-8">
    <header className="mb-8 md:mb-12 flex justify-between items-start">
      <div>
        <h1 className={`text-2xl md:text-3xl font-bold tracking-tighter ${theme.accent} mb-1 uppercase`}>
          {{ 'criosfera': 'Criosfera', 'gearheart': 'Gearheart', 'echo-vessel': 'Echo Vessel', 'vocoder': 'Vocoder', 'breitema': 'Brétema' }[currentEngine] || currentEngine}
        </h1>
        <h2 className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] opacity-50">
          {currentEngine === 'criosfera' ? 'Modulador Atmosférico' :
            currentEngine === 'gearheart' ? 'Matriz de Ritmo' :
              currentEngine === 'echo-vessel' ? 'Transmutador Vocal' :
                currentEngine === 'breitema' ? 'Reixa Generativa' : 'Sintese Espectral'}
        </h2>
      </div>
      <button onClick={() => setIsSettingsOpen(true)} className="hidden md:block p-2 opacity-50 hover:opacity-100">
        ⚙️
      </button>
    </header>

    <div className={`flex-1 overflow-y-auto pr-2 scrollbar-thin ${!isActive ? 'opacity-40 pointer-events-none' : ''}`}>
      <ControlSlider label={labels.pressure} value={state.pressure} onChange={(v) => updateParam(ParameterType.PRESSURE, v)} />
      <ControlSlider label={labels.resonance} value={state.resonance} onChange={(v) => updateParam(ParameterType.RESONANCE, v)} />
      <ControlSlider label={labels.viscosity} value={state.viscosity} onChange={(v) => updateParam(ParameterType.VISCOSITY, v)} />
      <ControlSlider label={labels.turbulence} value={state.turbulence} onChange={(v) => updateParam(ParameterType.TURBULENCE, v)} />
      <ControlSlider label={labels.diffusion} value={state.diffusion} onChange={(v) => updateParam(ParameterType.DIFFUSION, v)} />
    </div>

    <div className={`pt-6 border-t ${theme.border} mt-auto`}>
      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-4 font-bold">
        {currentEngine === 'criosfera' ? 'Xerador de atmósferas' :
          currentEngine === 'gearheart' ? 'Xerador de Maquinaria' :
            currentEngine === 'echo-vessel' ? 'Xerador de Profecías' :
              currentEngine === 'breitema' ? 'Xerador de Patróns' : 'Xerador de Covas'}
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder={apiKey ? "Descrición..." : "Configura a API Key"}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          disabled={!apiKey}
          className={`w-full bg-black/40 border ${theme.border} p-3 text-sm focus:outline-none transition-colors disabled:opacity-50 ${theme.text}`}
          onKeyDown={(e) => e.key === 'Enter' && generateAIPatch()}
        />
        <button
          onClick={generateAIPatch}
          disabled={isAiLoading || !isActive || !apiKey}
          className={`absolute right-2 top-1.5 p-2 ${theme.accent} disabled:opacity-30`}
        >
          {isAiLoading ? '...' : '→'}
        </button>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed italic opacity-60 min-h-[4em] max-h-[8em] overflow-y-auto font-mono">
        {titanReport}
      </p>
    </div>
  </div>
);

export default ControlsPanel;
