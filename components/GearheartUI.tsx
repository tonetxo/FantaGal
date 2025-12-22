import React from 'react';
import GearSequencer from './GearSequencer';
import { synthManager } from '../services/SynthManager';

interface GearheartUIProps {
  onToggle: () => void;
  isAiLoading: boolean;
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  onGenerate: () => void;
  report: string;
  hasApiKey: boolean;
}

const GearheartUI: React.FC<GearheartUIProps> = ({ 
  isAiLoading, 
  aiPrompt, 
  setAiPrompt, 
  onGenerate, 
  report,
  hasApiKey
}) => {
  // Callback cando unha engrenaxe completa un ciclo
  const handleGearTrigger = (radius: number) => {
    // Mapear radio a frecuencia: menor radio -> maior frecuencia
    // Rango aprox 30px a 60px
    const baseFreq = 110;
    const multiplier = 100 / radius; 
    const freq = baseFreq * multiplier;
    synthManager.playNote(freq);
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#151210]">
      {/* Header Compacto */}
      <div className="absolute top-16 left-0 w-full z-10 p-4 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto">
            <h1 className="text-2xl font-bold text-[#ffbf69] tracking-tighter font-serif" style={{ textShadow: '0 0 10px rgba(255, 191, 105, 0.3)' }}>
            GEARHEART
            </h1>
            <h2 className="text-[#b08d55] text-[8px] uppercase tracking-[0.4em] font-bold">Matriz de Ritmo</h2>
        </div>
        
        {/* AI Control Compacto - Ampliado */}
        <div className="w-64 bg-black/80 border border-[#b08d55]/50 p-3 rounded backdrop-blur-md pointer-events-auto shadow-lg mt-2">
            <div className="relative flex">
                <input 
                    type="text" 
                    placeholder={hasApiKey ? "Comando de vapor..." : "Configura a API Key primeiro"}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    disabled={!hasApiKey}
                    className="w-full bg-transparent text-xs text-[#ffbf69] focus:outline-none placeholder-[#a3907c] font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
                />
                <button 
                    onClick={onGenerate}
                    disabled={isAiLoading || !hasApiKey}
                    className="text-[#b08d55] hover:text-[#ffbf69] text-sm ml-2"
                >
                    {isAiLoading ? '...' : '⚙️'}
                </button>
            </div>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div className="flex-1 w-full h-full relative">
        <GearSequencer onTrigger={handleGearTrigger} />
      </div>
      
      {/* Footer Info - Moved to Top Right to avoid overlap */}
      <div className="absolute top-20 right-4 z-10 max-w-[150px] pointer-events-none text-right">
         <p className="text-[#a3907c] text-[10px] font-mono leading-relaxed italic opacity-80 bg-black/40 p-2 rounded">
            {report}
         </p>
      </div>
    </div>
  );
};

export default GearheartUI;