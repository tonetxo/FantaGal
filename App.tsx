import React, { useState, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { SynthState, ParameterType } from './types';
import { synthManager } from './services/SynthManager';
import { fetchTitanCondition } from './services/GeminiService';
import Visualizer from './components/Visualizer';
import ControlSlider from './components/ControlSlider';
import BubbleXYPad from './components/BubbleXYPad';
import GearSequencer from './components/GearSequencer';
import EchoVesselUI from './components/EchoVesselUI';

const NOTES = [
  { label: 'C2', freq: 65.41 },
  { label: 'G2', freq: 98.00 },
  { label: 'C3', freq: 130.81 },
  { label: 'Eb3', freq: 155.56 },
  { label: 'G3', freq: 196.00 },
  { label: 'Bb3', freq: 233.08 },
  { label: 'C4', freq: 261.63 },
];

const PARAM_LABELS_CRIOSFERA: Record<string, string> = {
  pressure: "PRESIÓN",
  resonance: "RESONANCIA",
  viscosity: "VISCOSIDADE",
  turbulence: "TURBULENCIA",
  diffusion: "DIFUSIÓN"
};

const PARAM_LABELS_GEARHEART: Record<string, string> = {
  pressure: "PRESIÓN VAPOR",
  resonance: "RESONANCIA LATÓN",
  viscosity: "VELOCIDADE",
  turbulence: "COMPLEXIDADE",
  diffusion: "DIFUSIÓN ÉTER"
};

const PARAM_LABELS_ECHO_VESSEL: Record<string, string> = {
  pressure: "RETROALIMENTACIÓN",
  resonance: "FILTRADO ÁMBAR",
  viscosity: "RETARDO FLUIDO",
  turbulence: "MODULACIÓN MERCURIO",
  diffusion: "DIFUSIÓN ESPACIAL"
};

interface ControlsPanelProps {
  currentEngine: 'criosfera' | 'gearheart' | 'echo-vessel';
  theme: any;
  state: SynthState;
  isActive: boolean;
  handleStart: () => void;
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
  handleStart,
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
          {currentEngine.replace('-', ' ')}
        </h1>
        <h2 className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] opacity-50">
          {currentEngine === 'criosfera' ? 'Modulador Atmosférico' :
            currentEngine === 'gearheart' ? 'Matriz de Ritmo' : 'Transmutador Vocal'}
        </h2>
      </div>
      <button onClick={() => setIsSettingsOpen(true)} className="hidden md:block p-2 opacity-50 hover:opacity-100">
        ⚙️
      </button>
    </header>

    {!isActive ? (
      <button
        onClick={handleStart}
        className={`w-full py-4 ${theme.accent} border ${theme.border} font-bold rounded-sm transition-all mb-8 bg-white/5 hover:bg-white/10`}
      >
        INICIALIZAR NÚCLEO
      </button>
    ) : (
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
        <ControlSlider label={labels.pressure} value={state.pressure} onChange={(v) => updateParam(ParameterType.PRESSURE, v)} />
        <ControlSlider label={labels.resonance} value={state.resonance} onChange={(v) => updateParam(ParameterType.RESONANCE, v)} />
        <ControlSlider label={labels.viscosity} value={state.viscosity} onChange={(v) => updateParam(ParameterType.VISCOSITY, v)} />
        <ControlSlider label={labels.turbulence} value={state.turbulence} onChange={(v) => updateParam(ParameterType.TURBULENCE, v)} />
        <ControlSlider label={labels.diffusion} value={state.diffusion} onChange={(v) => updateParam(ParameterType.DIFFUSION, v)} />
      </div>
    )}

    <div className={`pt-6 border-t ${theme.border} mt-auto`}>
      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-4 font-bold">
        {currentEngine === 'criosfera' ? 'Xerador de atmósferas' :
          currentEngine === 'gearheart' ? 'Xerador de Maquinaria (IA)' : 'Xerador de Profecías'}
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

function App() {
  const [currentEngine, setCurrentEngine] = useState<'criosfera' | 'gearheart' | 'echo-vessel'>('criosfera');

  // Track which engines have been initialized (per-engine, not global)
  const [initializedEngines, setInitializedEngines] = useState<Set<string>>(new Set());

  const [state, setState] = useState<SynthState>({
    pressure: 0.7,
    resonance: 0.6,
    viscosity: 0.3,
    turbulence: 0.2,
    diffusion: 0.4,
  });

  // Helper to check if current engine is initialized
  const isCurrentEngineActive = initializedEngines.has(currentEngine);

  const [aiPrompt, setAiPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [titanReport, setTitanReport] = useState<string>('Sistema en espera...');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentGearConfig, setCurrentGearConfig] = useState<{ numGears: number; arrangement: string } | null>(null);

  const [xyParams, setXyParams] = useState({
    x: ParameterType.RESONANCE,
    y: ParameterType.PRESSURE
  });

  const [playingFrequencies, setPlayingFrequencies] = useState<Map<number, number>>(new Map());
  const activeNotesRef = useRef<Map<number, number>>(new Map());

  // Labels actuais segundo motor
  const getLabels = () => {
    switch (currentEngine) {
      case 'criosfera': return PARAM_LABELS_CRIOSFERA;
      case 'gearheart': return PARAM_LABELS_GEARHEART;
      case 'echo-vessel': return PARAM_LABELS_ECHO_VESSEL;
      default: return PARAM_LABELS_CRIOSFERA;
    }
  }
  const labels = getLabels();

  // Theme colors
  const getTheme = () => {
    if (currentEngine === 'criosfera') {
      return { bg: 'bg-stone-950', text: 'text-stone-100', accent: 'text-orange-500', border: 'border-stone-800' };
    } else if (currentEngine === 'gearheart') {
      return { bg: 'bg-[#151210]', text: 'text-[#d4c5a9]', accent: 'text-[#ffbf69]', border: 'border-[#b08d55]/30' };
    } else {
      return { bg: 'bg-[#0a0f14]', text: 'text-slate-200', accent: 'text-cyan-500', border: 'border-cyan-900/30' };
    }
  }
  const theme = getTheme();

  useEffect(() => {
    const loadKey = async () => {
      const { value } = await Preferences.get({ key: 'gemini_api_key' });
      if (value) setApiKey(value);
    };
    loadKey();
  }, []);

  const saveApiKey = async (key: string) => {
    const trimmedKey = key.trim();
    setApiKey(trimmedKey);
    await Preferences.set({ key: 'gemini_api_key', value: trimmedKey });
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    if (isCurrentEngineActive) {
      synthManager.updateParameters(state);
    }
  }, [state, currentEngine, isCurrentEngineActive]);

  const handleStart = async () => {
    await synthManager.init();
    await synthManager.resume();
    // Mark only the current engine as initialized
    setInitializedEngines(prev => new Set(prev).add(currentEngine));
  };

  const handleEngineChange = (engine: 'criosfera' | 'gearheart' | 'echo-vessel') => {
    setCurrentEngine(engine);
    synthManager.switchEngine(engine);
    if (engine === 'criosfera') setTitanReport('Modo sustain activo: alterna as teclas.');
    else if (engine === 'gearheart') setTitanReport('Matriz de ritmo lista. Arrastra as engrenaxes.');
    else setTitanReport('Alquimia vocal. Usa os viais e captura a túa voz.');
  };

  const updateParam = (param: ParameterType, value: number) => {
    setState(prev => ({ ...prev, [param]: value }));
  };

  const toggleNote = (freq: number) => {
    if (!isCurrentEngineActive) {
      handleStart();
      return;
    }

    if (activeNotesRef.current.has(freq)) {
      const id = activeNotesRef.current.get(freq);
      if (id !== undefined) {
        synthManager.stopNote(id);
        activeNotesRef.current.delete(freq);
        setPlayingFrequencies(prev => {
          const next = new Map(prev);
          next.delete(freq);
          return next;
        });
      }
    } else {
      const id = synthManager.playNote(freq, 0.7);
      if (id !== undefined) {
        activeNotesRef.current.set(freq, id);
        setPlayingFrequencies(prev => {
          const next = new Map(prev);
          next.set(freq, id);
          return next;
        });
      }
    }
  };

  const generateAIPatch = async () => {
    if (!aiPrompt || !apiKey) return;
    setIsAiLoading(true);
    try {
      const condition = await fetchTitanCondition(aiPrompt, apiKey);

      // Use values from AI or fallbacks to prevent crash
      const s = {
        turbulence: condition.stormLevel ?? 0.5,
        viscosity: condition.methaneDensity ?? 0.5,
        pressure: condition.temperature ?? 0.5,
        resonance: 0.5 + ((condition.stormLevel ?? 0.5) * 0.5),
        diffusion: 0.3 + ((condition.methaneDensity ?? 0.5) * 0.4)
      };

      setState(prev => ({
        ...prev,
        ...s
      }));

      // Only apply gearConfig when in Gearheart mode
      if (currentEngine === 'gearheart' && condition.gearConfig) {
        setCurrentGearConfig(condition.gearConfig);
      }

      const reportText = condition.description || "Transmutación completada.";
      setTitanReport(reportText);

      // Update Speech Text only if in Echo Vessel
      if (currentEngine === 'echo-vessel') {
        const echoEngine = synthManager.getEchoVesselEngine();
        if (echoEngine) {
          echoEngine.setSpeechText(reportText);
          echoEngine.speakOnce();
        }
      }
    } catch (err: any) {
      console.error("AI Patch Error:", err);

      // Provide more specific error messages based on error type
      let errorMessage = "Erro descoñecido ao consultar o Oráculo.";
      const errMsg = err?.message?.toLowerCase() || '';

      if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('failed to fetch')) {
        errorMessage = "Erro de conexión. Verifica a túa rede e tenta de novo.";
      } else if (errMsg.includes('401') || errMsg.includes('api key') || errMsg.includes('unauthorized')) {
        errorMessage = "Erro de autenticación. A API Key pode ser inválida.";
      } else if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('quota')) {
        errorMessage = "Demasiadas solicitudes. Agarda uns segundos e tenta de novo.";
      } else if (errMsg.includes('timeout')) {
        errorMessage = "A solicitude tardou demasiado. Tenta de novo.";
      } else if (err?.message) {
        errorMessage = `Erro: ${err.message}`;
      }

      setTitanReport(errorMessage);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className={`relative w-full h-screen flex flex-col md:flex-row overflow-hidden transition-colors duration-500 pt-12 ${theme.bg} ${theme.text}`}>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-stone-100">
          <div className="bg-stone-900 border border-stone-700 p-6 w-full max-w-md rounded-lg shadow-2xl">
            <h3 className="text-lg font-bold text-orange-500 mb-4">Configuración de Gemini</h3>
            <p className="text-xs text-stone-400 mb-4">Introduce a túa API Key.</p>
            <input
              type="password"
              placeholder="API Key..."
              className="w-full bg-black/50 border border-stone-600 p-3 text-sm mb-4 focus:border-orange-500 outline-none"
              defaultValue={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-stone-400">Cancelar</button>
              <button onClick={() => saveApiKey(apiKey)} className="px-4 py-2 bg-orange-600 rounded">Gardar</button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full z-[100] flex justify-center pt-3 pointer-events-none">
        <div className="flex gap-1 bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10 pointer-events-auto shadow-xl">
          <button
            onClick={() => handleEngineChange('criosfera')}
            className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'criosfera' ? 'bg-stone-800 text-orange-400 shadow-sm' : 'opacity-50 hover:opacity-100'
              }`}
          >
            Criosfera
          </button>
          <button
            onClick={() => handleEngineChange('gearheart')}
            className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'gearheart' ? 'bg-[#3a2e26] text-[#ffbf69] shadow-sm' : 'opacity-50 hover:opacity-100'
              }`}
          >
            Gearheart
          </button>
          <button
            onClick={() => handleEngineChange('echo-vessel')}
            className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'echo-vessel' ? 'bg-cyan-900 text-cyan-400 shadow-sm' : 'opacity-50 hover:opacity-100'
              }`}
          >
            Echo Vessel
          </button>
        </div>
      </div>

      <aside className={`hidden md:flex w-80 h-full bg-black/20 backdrop-blur-xl border-r ${theme.border} p-8 z-30`}>
        <ControlsPanel
          currentEngine={currentEngine}
          theme={theme}
          state={state}
          isActive={isCurrentEngineActive}
          handleStart={handleStart}
          updateParam={updateParam}
          labels={labels}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          apiKey={apiKey}
          generateAIPatch={generateAIPatch}
          isAiLoading={isAiLoading}
          titanReport={titanReport}
          setIsSettingsOpen={setIsSettingsOpen}
        />
      </aside>

      {isMobileMenuOpen && (
        <div className={`md:hidden fixed inset-0 z-50 ${theme.bg} p-8 pt-20 animate-in fade-in slide-in-from-bottom-4 duration-300`}>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-6 right-6 p-2 text-xl opacity-50"
          >
            ✕
          </button>
          <ControlsContentWrapper>
            <ControlsPanel
              currentEngine={currentEngine}
              theme={theme}
              state={state}
              isActive={isCurrentEngineActive}
              handleStart={handleStart}
              updateParam={updateParam}
              labels={labels}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              apiKey={apiKey}
              generateAIPatch={generateAIPatch}
              isAiLoading={isAiLoading}
              titanReport={titanReport}
              setIsSettingsOpen={setIsSettingsOpen}
            />
          </ControlsContentWrapper>
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1 h-full w-full">

        <div className="md:hidden absolute top-0 left-0 w-full flex justify-between items-center p-6 pt-16 z-40 pointer-events-none">
          <div className="pointer-events-auto">
            <h1 className={`text-xl font-bold tracking-tighter ${theme.accent} uppercase`}>{currentEngine.replace('-', ' ')}</h1>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-3 bg-black/40 border ${theme.border} rounded-full opacity-70 active:scale-95 transition-transform`}
            >
              ⚙️
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`p-3 bg-black/40 border ${theme.border} rounded-full ${theme.accent} active:scale-95 transition-transform`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>

        <main className="flex-1 flex flex-col justify-center md:justify-end p-6 md:p-12 items-center relative w-full h-full">
          {currentEngine === 'criosfera' ? (
            <>
              <div className="absolute inset-0 pointer-events-none">
                <Visualizer turbulence={state.turbulence} viscosity={state.viscosity} pressure={state.pressure} />
              </div>
              <div className="mt-auto w-full max-w-md flex flex-col items-center z-10">
                <div className="w-full mb-4">
                  <div className="flex justify-between mb-2 px-2">
                    <select
                      value={xyParams.y}
                      onChange={(e) => setXyParams(prev => ({ ...prev, y: e.target.value as ParameterType }))}
                      className={`bg-black/60 border ${theme.border} text-[10px] ${theme.accent} uppercase tracking-widest p-1 rounded`}
                    >
                      {Object.values(ParameterType).map(p => <option key={p} value={p}>{labels[p]}</option>)}
                    </select>
                    <select
                      value={xyParams.x}
                      onChange={(e) => setXyParams(prev => ({ ...prev, x: e.target.value as ParameterType }))}
                      className={`bg-black/60 border ${theme.border} text-[10px] ${theme.accent} uppercase tracking-widest p-1 rounded`}
                    >
                      {Object.values(ParameterType).map(p => <option key={p} value={p}>{labels[p]}</option>)}
                    </select>
                  </div>
                  <BubbleXYPad
                    xValue={state[xyParams.x]}
                    yValue={state[xyParams.y]}
                    xLabel={labels[xyParams.x]}
                    yLabel={labels[xyParams.y]}
                    onChange={(x, y) => setState(prev => ({ ...prev, [xyParams.x]: x, [xyParams.y]: y }))}
                  />
                </div>
                <div className="w-full grid grid-cols-7 gap-2">
                  {NOTES.map((note) => {
                    const isActive = playingFrequencies.has(note.freq);
                    return (
                      <button
                        key={note.label}
                        onClick={() => toggleNote(note.freq)}
                        className={`h-24 border transition-all flex flex-col items-center justify-end pb-2 rounded-sm active:scale-[0.98] ${isActive
                          ? `bg-orange-500/40 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]`
                          : `bg-black/40 border-white/10`
                          }`}
                      >
                        <span className={`text-xl font-bold ${isActive ? 'text-white' : 'opacity-50'}`}>{note.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : currentEngine === 'gearheart' ? (
            <div className="w-full h-full relative">
              <GearSequencer
                diffusion={state.diffusion}
                gearConfig={currentGearConfig}
              />
            </div>
          ) : (
            <div className="w-full h-full relative">
              <EchoVesselUI
                isActive={isCurrentEngineActive}
                engine={isCurrentEngineActive ? synthManager.getEchoVesselEngine() : undefined}
                aiPrompt={aiPrompt}
                onGenerate={generateAIPatch}
                hasApiKey={!!apiKey}
                report={titanReport}
                isAiLoading={isAiLoading}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const ControlsContentWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full w-full">{children}</div>
);

export default App;