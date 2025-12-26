import React from 'react';

interface EngineSelectorProps {
    currentEngine: string;
    onEngineChange: (engine: 'criosfera' | 'gearheart' | 'echo-vessel' | 'vocoder') => void;
}

const EngineSelector = ({ currentEngine, onEngineChange }: EngineSelectorProps) => {
    return (
        <div className="absolute top-0 left-0 w-full z-[100] flex justify-center pt-3 pointer-events-none">
            <div className="flex gap-1 bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10 pointer-events-auto shadow-xl">
                <button
                    onClick={() => onEngineChange('criosfera')}
                    className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'criosfera' ? 'bg-stone-800 text-orange-400 shadow-sm' : 'opacity-50 hover:opacity-100'
                        }`}
                >
                    Criosfera
                </button>
                <button
                    onClick={() => onEngineChange('gearheart')}
                    className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'gearheart' ? 'bg-[#3a2e26] text-[#ffbf69] shadow-sm' : 'opacity-50 hover:opacity-100'
                        }`}
                >
                    Gearheart
                </button>
                <button
                    onClick={() => onEngineChange('echo-vessel')}
                    className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'echo-vessel' ? 'bg-cyan-900 text-cyan-400 shadow-sm' : 'opacity-50 hover:opacity-100'
                        }`}
                >
                    Echo Vessel
                </button>
                <button
                    onClick={() => onEngineChange('vocoder')}
                    className={`px-3 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all ${currentEngine === 'vocoder' ? 'bg-emerald-900 text-emerald-400 shadow-sm' : 'opacity-50 hover:opacity-100'
                        }`}
                >
                    Vocoder
                </button>
            </div>
        </div>
    );
};

export default EngineSelector;
