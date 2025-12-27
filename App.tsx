import React, { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { ParameterType } from './types';
import { synthManager } from './services/SynthManager';
import Visualizer from './components/Visualizer';
import BubbleXYPad from './components/BubbleXYPad';
import GearSequencer from './components/GearSequencer';
import EchoVesselUI from './components/EchoVesselUI';
import VocoderUI from './components/VocoderUI';
import BreitemaUI from './components/BreitemaUI';
import EngineSelector from './components/EngineSelector';
import ControlsPanel from './components/ControlsPanel';
import { useSynth } from './hooks/useSynth';

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

// Echo Vessel labels change based on selected vial
const PARAM_LABELS_ECHO_NEUTRAL: Record<string, string> = {
  pressure: "GANANCIA",
  resonance: "—",
  viscosity: "ECO",
  turbulence: "—",
  diffusion: "ESPACIALIDADE"
};

const PARAM_LABELS_ECHO_MERCURY: Record<string, string> = {
  pressure: "GANANCIA",
  resonance: "TONO MODULADOR",
  viscosity: "—",
  turbulence: "FREQ. MODULACIÓN",
  diffusion: "ESPACIALIDADE"
};

const PARAM_LABELS_ECHO_AMBER: Record<string, string> = {
  pressure: "FEEDBACK DELAY",
  resonance: "SATURACIÓN",
  viscosity: "TEMPO DELAY",
  turbulence: "—",
  diffusion: "ESPACIALIDADE"
};

const PARAM_LABELS_VOCODER: Record<string, string> = {
  pressure: "HUMIDADE DAS COVAS",
  resonance: "RESONANCIA CRISTALINA",
  viscosity: "BALANCE PORTADORAS",
  turbulence: "DESPLAZAMENTO FORMANTE",
  diffusion: "PROFUNDIDADE CAVERNA"
};

const PARAM_LABELS_BREITEMA: Record<string, string> = {
  pressure: "TEMPO",
  resonance: "PROFUNDIDADE FM",
  viscosity: "DENSIDADE BRÉTEMA",
  turbulence: "MOVEMENTO NÉBOA",
  diffusion: "REVERBERACIÓN"
};

function App() {
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [echoVial, setEchoVial] = useState<'neutral' | 'mercury' | 'amber'>('neutral');

  const {
    currentEngine,
    state,
    isCurrentActive,
    aiPrompt,
    titanReport,
    isAiLoading,
    playingFrequencies,
    switchEngine,
    toggleEngine,
    updateParam,
    toggleNote,
    generateAIPatch,
    setAiPrompt,
    handleStart,
    restoreAudio
  } = useSynth('criosfera', apiKey);

  const [xyParams, setXyParams] = useState({
    x: ParameterType.RESONANCE,
    y: ParameterType.PRESSURE
  });

  // Labels actuais segundo motor
  const getLabels = () => {
    switch (currentEngine) {
      case 'criosfera': return PARAM_LABELS_CRIOSFERA;
      case 'gearheart': return PARAM_LABELS_GEARHEART;
      case 'echo-vessel':
        // Dynamic labels based on selected vial
        if (echoVial === 'mercury') return PARAM_LABELS_ECHO_MERCURY;
        if (echoVial === 'amber') return PARAM_LABELS_ECHO_AMBER;
        return PARAM_LABELS_ECHO_NEUTRAL;
      case 'vocoder': return PARAM_LABELS_VOCODER;
      case 'breitema': return PARAM_LABELS_BREITEMA;
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
    } else if (currentEngine === 'vocoder') {
      return { bg: 'bg-[#0d1117]', text: 'text-emerald-100', accent: 'text-emerald-400', border: 'border-emerald-900/30' };
    } else if (currentEngine === 'breitema') {
      return { bg: 'bg-[#0f1318]', text: 'text-[#9faab8]', accent: 'text-[#8be9fd]', border: 'border-[#44475a]/40' };
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

  // Connect engine audio taps to vocoder when vocoder is active
  useEffect(() => {
    if (currentEngine !== 'vocoder' || !isCurrentActive) return;

    const vocoderEngine = synthManager.getVocoderEngine();
    if (!vocoderEngine) return;

    let criosferaTap: GainNode | null = null;
    let gearheartTap: GainNode | null = null;

    try {
      // Access internals - safer to add public accessors in SynthManager in future
      const criosferaEngine = (synthManager as any).engines.get('criosfera');
      const gearheartEngine = (synthManager as any).engines.get('gearheart');

      if (criosferaEngine && typeof (criosferaEngine as any).getOutputTap === 'function') {
        criosferaTap = (criosferaEngine as any).getOutputTap() || null;
      }
      if (gearheartEngine && typeof (gearheartEngine as any).getOutputTap === 'function') {
        gearheartTap = (gearheartEngine as any).getOutputTap() || null;
      }
    } catch (e) {
      console.error('[App] Error getting engine taps:', e);
    }

    vocoderEngine.setCarrierSources(criosferaTap, gearheartTap);
    console.log('[App] Connected engine taps to vocoder carrier');
  }, [currentEngine, isCurrentActive]);

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

      <EngineSelector currentEngine={currentEngine} onEngineChange={switchEngine} />

      <aside className={`hidden md:flex w-80 h-full bg-black/20 backdrop-blur-xl border-r ${theme.border} p-8 z-30`}>
        <ControlsPanel
          currentEngine={currentEngine}
          theme={theme}
          state={state}
          isActive={isCurrentActive}
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
            className="absolute top-20 right-6 p-2 text-xl opacity-50"
          >
            ✕
          </button>
          <ControlsContentWrapper>
            <ControlsPanel
              currentEngine={currentEngine}
              theme={theme}
              state={state}
              isActive={isCurrentActive}
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
          <button
            onClick={toggleEngine}
            className="pointer-events-auto flex items-center gap-2 active:scale-95 transition-transform"
          >
            <span className={`w-2 h-2 rounded-full ${isCurrentActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`} />
            <h1 className={`text-xl font-bold tracking-tighter uppercase ${isCurrentActive ? theme.accent : 'opacity-50'}`}>
              {currentEngine.replace('-', ' ')}
            </h1>
          </button>
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={restoreAudio}
              className={`p-3 bg-black/40 border ${theme.border} rounded-full opacity-70 active:scale-95 transition-transform`}
              title="Restaurar Audio"
            >
              🔊
            </button>
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

        {/* AI Generated Text Overlay - between engine selector and header */}
        {isCurrentActive && titanReport && titanReport !== 'Sistema en espera...' && (
          <div className="md:hidden absolute top-4 left-0 w-full px-6 z-30 pointer-events-none">
            <div className={`text-xs ${theme.accent} opacity-70 font-mono tracking-wide text-center`}>
              {titanReport}
            </div>
          </div>
        )}

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
                    onChange={(x, y) => { updateParam(xyParams.x, x); updateParam(xyParams.y, y); }}
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
                isActive={isCurrentActive}
              />
            </div>
          ) : currentEngine === 'vocoder' ? (
            <div className="w-full h-full relative">
              <VocoderUI
                isActive={isCurrentActive}
                engine={isCurrentActive ? synthManager.getVocoderEngine() : undefined}
              />
            </div>
          ) : currentEngine === 'breitema' ? (
            <div className="w-full h-full relative">
              <BreitemaUI
                isActive={isCurrentActive}
                theme={theme}
              />
            </div>
          ) : (
            <div className="w-full h-full relative">
              <EchoVesselUI
                isActive={isCurrentActive}
                engine={isCurrentActive ? synthManager.getEchoVesselEngine() : undefined}
                aiPrompt={aiPrompt}
                onGenerate={generateAIPatch}
                hasApiKey={!!apiKey}
                report={titanReport}
                isAiLoading={isAiLoading}
                onVialChange={setEchoVial}
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