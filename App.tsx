import React, { useState, useEffect, useRef } from 'react';
import { SynthState, ParameterType, PlanetaryCondition } from './types';
import { audioEngine } from './services/AudioEngine';
import { fetchTitanCondition } from './services/GeminiService';
import Visualizer from './components/Visualizer';
import ControlSlider from './components/ControlSlider';
import BubbleXYPad from './components/BubbleXYPad';

const NOTES = [
  { label: 'C2', freq: 65.41 },
  { label: 'G2', freq: 98.00 },
  { label: 'C3', freq: 130.81 },
  { label: 'Eb3', freq: 155.56 },
  { label: 'G3', freq: 196.00 },
  { label: 'Bb3', freq: 233.08 },
  { label: 'C4', freq: 261.63 },
];

interface ControlsContentProps {
  state: SynthState;
  handleStart: () => void;
  updateParam: (param: ParameterType, value: number) => void;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  generateAIPatch: () => void;
  isAiLoading: boolean;
  titanReport: string;
}

const ControlsContent = ({
  state,
  handleStart,
  updateParam,
  aiPrompt,
  setAiPrompt,
  generateAIPatch,
  isAiLoading,
  titanReport
}: ControlsContentProps) => (
  <div className="flex flex-col h-full">
    <header className="mb-8 md:mb-12">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tighter text-orange-500 mb-1">CRIOSFERA</h1>
      <h2 className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-orange-200/40">Atmosphere Modulator</h2>
    </header>

    {!state.isAudioActive ? (
      <button 
        onClick={handleStart}
        className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-sm transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] mb-8"
      >
        INITIALIZE CORE
      </button>
    ) : (
      <div className="flex-1 overflow-y-auto pr-2">
        <ControlSlider label="Surface Pressure" value={state.pressure} onChange={(v) => updateParam(ParameterType.PRESSURE, v)} />
        <ControlSlider label="Spectral Resonance" value={state.resonance} onChange={(v) => updateParam(ParameterType.RESONANCE, v)} />
        <ControlSlider label="Methane Viscosity" value={state.viscosity} onChange={(v) => updateParam(ParameterType.VISCOSITY, v)} />
        <ControlSlider label="Aero-Turbulence" value={state.turbulence} onChange={(v) => updateParam(ParameterType.TURBULENCE, v)} />
        <ControlSlider label="Sound Diffusion" value={state.diffusion} onChange={(v) => updateParam(ParameterType.DIFFUSION, v)} />
      </div>
    )}

    <div className="pt-6 border-t border-stone-800/50 mt-auto">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-4">AI Patch Link</div>
      <div className="relative">
        <input 
          type="text" 
          placeholder="Atmospheric prompt..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          className="w-full bg-black/40 border border-stone-800 p-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && generateAIPatch()}
        />
        <button 
          onClick={generateAIPatch}
          disabled={isAiLoading || !state.isAudioActive}
          className="absolute right-2 top-1.5 p-2 text-orange-500 hover:text-orange-400 disabled:text-stone-700"
        >
          {isAiLoading ? '...' : '→'}
        </button>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-stone-400 italic min-h-[4em] max-h-[8em] overflow-y-auto">
        {titanReport}
      </p>
    </div>
  </div>
);

function App() {
  const [state, setState] = useState<SynthState>({
    pressure: 0.7,
    resonance: 0.6,
    viscosity: 0.3,
    turbulence: 0.2,
    diffusion: 0.4,
    isAudioActive: false,
  });

  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [titanReport, setTitanReport] = useState<string>('Sustain mode active: toggle keys to start the atmosphere.');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [xyParams, setXyParams] = useState({
    x: ParameterType.RESONANCE,
    y: ParameterType.PRESSURE
  });

  const [playingFrequencies, setPlayingFrequencies] = useState<Map<number, number>>(new Map());
  const activeNotesRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (state.isAudioActive) {
      audioEngine.updateParameters(state);
    }
  }, [state]);

  const handleStart = async () => {
    await audioEngine.init();
    await audioEngine.resume();
    setState(prev => ({ ...prev, isAudioActive: true }));
  };

  const updateParam = (param: ParameterType, value: number) => {
    setState(prev => ({ ...prev, [param]: value }));
  };

  const toggleNote = (freq: number) => {
    if (!state.isAudioActive) {
      handleStart();
      return;
    }

    if (activeNotesRef.current.has(freq)) {
      const id = activeNotesRef.current.get(freq);
      if (id !== undefined) {
        audioEngine.stopNote(id);
        activeNotesRef.current.delete(freq);
        setPlayingFrequencies(prev => {
          const next = new Map(prev);
          next.delete(freq);
          return next;
        });
      }
    } else {
      const id = audioEngine.playNote(freq, 0.7);
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
    if (!aiPrompt) return;
    setIsAiLoading(true);
    try {
      const condition = await fetchTitanCondition(aiPrompt);
      setState(prev => ({
        ...prev,
        turbulence: condition.stormLevel,
        viscosity: condition.methaneDensity,
        pressure: condition.temperature,
        resonance: 0.5 + (condition.stormLevel * 0.5)
      }));
      setTitanReport(condition.description);
    } catch (err) {
      setTitanReport("Atmospheric data link severed. Reverting to safe mode.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-stone-950 text-stone-100 flex flex-col md:flex-row overflow-hidden selection:bg-orange-500/30">
      <Visualizer turbulence={state.turbulence} viscosity={state.viscosity} pressure={state.pressure} />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-80 h-full bg-stone-900/40 backdrop-blur-xl border-r border-stone-800/50 p-8 z-30">
        <ControlsContent 
           state={state}
           handleStart={handleStart}
           updateParam={updateParam}
           aiPrompt={aiPrompt}
           setAiPrompt={setAiPrompt}
           generateAIPatch={generateAIPatch}
           isAiLoading={isAiLoading}
           titanReport={titanReport}
        />
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-6 right-6 p-2 text-stone-400 hover:text-white text-xl"
          >
            ✕
          </button>
          <ControlsContent 
             state={state}
             handleStart={handleStart}
             updateParam={updateParam}
             aiPrompt={aiPrompt}
             setAiPrompt={setAiPrompt}
             generateAIPatch={generateAIPatch}
             isAiLoading={isAiLoading}
             titanReport={titanReport}
          />
        </div>
      )}

      {/* Main UI Stage */}
      <div className="relative z-10 flex flex-col flex-1 h-full w-full">
        
        {/* Mobile Header / Status */}
        <div className="md:hidden flex justify-between items-center p-6 w-full">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-orange-500">CRIOSFERA</h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-3 bg-stone-900/60 border border-stone-800 rounded-full text-orange-400 active:scale-95 transition-transform"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        <main className="flex-1 flex flex-col justify-center md:justify-end p-6 md:p-12 items-center">
          <div className="mb-auto md:mb-12 text-center pointer-events-none select-none mt-4 md:mt-0 w-full flex flex-col items-center">
            <div className="text-4xl md:text-[120px] font-bold text-orange-500/10 leading-none mb-4 md:mb-8">TITAN</div>
            
            {/* XY Pad Area */}
            <div className="w-full max-w-sm mb-8 pointer-events-auto z-20">
              <div className="flex justify-between mb-2 px-2">
                <select 
                  value={xyParams.y} 
                  onChange={(e) => setXyParams(prev => ({ ...prev, y: e.target.value as ParameterType }))}
                  className="bg-stone-900/80 border border-stone-800 text-[10px] text-orange-400 uppercase tracking-widest p-1 rounded focus:outline-none focus:border-orange-500/50"
                >
                  {Object.values(ParameterType).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select 
                  value={xyParams.x} 
                  onChange={(e) => setXyParams(prev => ({ ...prev, x: e.target.value as ParameterType }))}
                  className="bg-stone-900/80 border border-stone-800 text-[10px] text-orange-400 uppercase tracking-widest p-1 rounded focus:outline-none focus:border-orange-500/50"
                >
                  {Object.values(ParameterType).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <BubbleXYPad 
                xValue={state[xyParams.x]}
                yValue={state[xyParams.y]}
                xLabel={xyParams.x}
                yLabel={xyParams.y}
                onChange={(x, y) => setState(prev => ({ ...prev, [xyParams.x]: x, [xyParams.y]: y }))}
              />
            </div>

            <div className="text-orange-400/30 mono text-[8px] md:text-sm uppercase tracking-[0.5em] md:tracking-[1em] -mt-1 md:-mt-4 hidden md:block">
              Physical Resonance Simulation
            </div>
          </div>

          {/* Keybed */}
          <div className="w-full max-w-5xl grid grid-cols-7 gap-2 md:gap-4">
            {NOTES.map((note) => {
              const isActive = playingFrequencies.has(note.freq);
              return (
                <button
                  key={note.label}
                  onClick={() => toggleNote(note.freq)}
                  className={`h-24 md:h-32 border transition-all flex flex-col items-center justify-end pb-2 md:pb-4 rounded-sm group relative overflow-hidden active:scale-[0.98] ${
                    isActive 
                      ? 'bg-orange-500/40 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]' 
                      : 'bg-stone-900/60 border-stone-800/40'
                  }`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 ${isActive ? 'bg-orange-400' : 'bg-stone-800'}`} />
                  <span className={`mono text-[8px] md:text-xs mb-1 md:mb-2 ${isActive ? 'text-orange-200' : 'text-stone-500'}`}>
                    {note.freq.toFixed(1)}Hz
                  </span>
                  <span className={`text-sm md:text-xl font-bold tracking-widest ${isActive ? 'text-white' : 'text-orange-200/80'}`}>
                    {note.label}
                  </span>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="hidden md:block mt-6 text-[10px] text-stone-600 uppercase tracking-widest mono">
            Toggle notes to sustain | Adjust parameters for spectral modulation
          </div>
        </main>
      </div>
      
      {/* HUD Elements */}
      <div className="absolute bottom-4 right-4 md:top-8 md:right-8 z-20 flex flex-col items-end text-[8px] md:text-[10px] text-stone-500 mono space-y-1 md:space-y-2 pointer-events-none select-none opacity-60 md:opacity-100">
        <div className="bg-black/20 p-1 rounded">LNG_DENSITY: {(state.viscosity * 100).toFixed(2)} KG/M3</div>
        <div className="bg-black/20 p-1 rounded">PIPE_LENGTH: {(state.resonance * 40).toFixed(1)}M</div>
        <div className="w-24 md:w-32 h-0.5 md:h-1 bg-stone-800 overflow-hidden mt-1">
          <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${state.pressure * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export default App;