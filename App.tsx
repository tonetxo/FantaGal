import React, { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { ParameterType } from './types';
import { synthManager } from './services/SynthManager';
import { engineRegistry } from './services/EngineRegistry';
import { ECHO_VESSEL_VIAL_LABELS } from './services/engines';
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

// Default theme for fallback
const DEFAULT_THEME = {
  bg: 'bg-stone-950',
  text: 'text-stone-100',
  accent: 'text-orange-500',
  border: 'border-stone-800'
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
    initializedEngines
  } = useSynth('criosfera', apiKey);

  const [xyParams, setXyParams] = useState({
    x: ParameterType.RESONANCE,
    y: ParameterType.PRESSURE
  });

  // Labels from registry with Echo Vessel vial support
  const getLabels = () => {
    if (currentEngine === 'echo-vessel') {
      return ECHO_VESSEL_VIAL_LABELS[echoVial];
    }
    const engineDef = engineRegistry.get(currentEngine);
    return engineDef?.paramLabels || {};
  }
  const labels = getLabels();

  // Theme from registry
  const getTheme = () => {
    const engineDef = engineRegistry.get(currentEngine);
    return engineDef?.theme || DEFAULT_THEME;
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

  // Connect engine audio taps to vocoder when vocoder is active OR when carrier engines change
  useEffect(() => {
    // Only run if vocoder is active
    if (!initializedEngines.has('vocoder')) return;

    const vocoderEngine = synthManager.getVocoderEngine();
    if (!vocoderEngine) return;

    // Get taps from active engines
    const criosferaTap = initializedEngines.has('criosfera')
      ? synthManager.getEngineTap('criosfera')
      : null;
    const gearheartTap = initializedEngines.has('gearheart')
      ? synthManager.getEngineTap('gearheart')
      : null;

    vocoderEngine.setCarrierSources(criosferaTap, gearheartTap);
    console.log('[App] Connected engine taps to vocoder carrier - criosfera:', !!criosferaTap, 'gearheart:', !!gearheartTap);
  }, [initializedEngines]);

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
              {{ 'criosfera': 'Criosfera', 'gearheart': 'Gearheart', 'echo-vessel': 'Echo Vessel', 'vocoder': 'Vocoder', 'breitema': 'Brétema' }[currentEngine] || currentEngine}
            </h1>
          </button>
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
                  <div className="flex justify-center gap-6 mb-2">
                    <select
                      value={xyParams.y}
                      onChange={(e) => setXyParams(prev => ({ ...prev, y: e.target.value as ParameterType }))}
                      className={`bg-black/60 border ${theme.border} text-[11px] ${theme.accent} uppercase tracking-wider p-1.5 px-3 rounded min-w-[130px]`}
                    >
                      {Object.values(ParameterType).map(p => <option key={p} value={p}>{labels[p]}</option>)}
                    </select>
                    <select
                      value={xyParams.x}
                      onChange={(e) => setXyParams(prev => ({ ...prev, x: e.target.value as ParameterType }))}
                      className={`bg-black/60 border ${theme.border} text-[11px] ${theme.accent} uppercase tracking-wider p-1.5 px-3 rounded min-w-[130px]`}
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
                <div className="w-full flex justify-center gap-1.5">
                  {NOTES.map((note) => {
                    const isActive = playingFrequencies.has(note.freq);
                    return (
                      <button
                        key={note.label}
                        onClick={() => toggleNote(note.freq)}
                        className={`flex-1 max-w-[52px] h-24 border transition-all flex flex-col items-center justify-end pb-2 rounded-sm active:scale-[0.98] ${isActive
                          ? `bg-orange-500/40 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]`
                          : `bg-black/40 border-white/10`
                          }`}
                      >
                        <span className={`text-lg font-bold ${isActive ? 'text-white' : 'opacity-50'}`}>{note.label}</span>
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