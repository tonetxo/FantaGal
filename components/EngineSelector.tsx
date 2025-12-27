import React from 'react';

interface EngineSelectorProps {
    currentEngine: string;
    onEngineChange: (engine: 'criosfera' | 'gearheart' | 'echo-vessel' | 'vocoder' | 'breitema') => void;
}

const ENGINES = [
    { id: 'criosfera', label: 'Criosfera', activeClass: 'bg-stone-800 text-orange-400' },
    { id: 'gearheart', label: 'Gearheart', activeClass: 'bg-[#3a2e26] text-[#ffbf69]' },
    { id: 'echo-vessel', label: 'Echo Vessel', activeClass: 'bg-cyan-900 text-cyan-400' },
    { id: 'vocoder', label: 'Vocoder', activeClass: 'bg-emerald-900 text-emerald-400' },
    { id: 'breitema', label: 'Brétema', activeClass: 'bg-[#1e2430] text-[#8be9fd]' },
] as const;

const EngineSelector = ({ currentEngine, onEngineChange }: EngineSelectorProps) => {
    return (
        <div className="absolute top-0 left-0 w-full z-[100] flex justify-center pt-3 pointer-events-none px-2">
            <div className="flex gap-1 bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10 pointer-events-auto shadow-xl overflow-x-auto max-w-full scrollbar-hide">
                {ENGINES.map(engine => (
                    <button
                        key={engine.id}
                        onClick={() => onEngineChange(engine.id as any)}
                        className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${currentEngine === engine.id
                                ? `${engine.activeClass} shadow-sm`
                                : 'opacity-50 hover:opacity-100'
                            }`}
                    >
                        {engine.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default EngineSelector;
