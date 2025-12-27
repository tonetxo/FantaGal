import React, { useState, useEffect, useRef } from 'react';
import { synthManager } from '../services/SynthManager';
import { BreitemaEngine } from '../services/engines/BreitemaEngine';

interface BreitemaUIProps {
    isActive: boolean;
    theme: {
        bg: string;
        text: string;
        accent: string;
        border: string;
    };
}

const RHYTHM_MODES = [
    { id: 'libre', label: 'Libre' },
    { id: 'muineira', label: 'Muiñeira (6/8)' },
    { id: 'ribeirada', label: 'Ribeirada' }
] as const;

const BreitemaUI: React.FC<BreitemaUIProps> = ({ isActive, theme }) => {
    const [steps, setSteps] = useState<boolean[]>(new Array(16).fill(false));
    const [currentStep, setCurrentStep] = useState(0);
    const [probabilities, setProbabilities] = useState<number[]>(new Array(16).fill(0.5));
    const [rhythmMode, setRhythmMode] = useState<'libre' | 'muineira' | 'ribeirada'>('libre');
    const [isPlaying, setIsPlaying] = useState(false);
    const animationRef = useRef<number | null>(null);

    const engine = synthManager.getEngine('breitema') as BreitemaEngine | undefined;

    // Update UI from engine state
    useEffect(() => {
        if (!isActive || !engine) return;

        const updateState = () => {
            const state = engine.getSequencerState();
            setSteps(state.steps);
            setCurrentStep(state.currentStep);
            setProbabilities(state.probabilities);
            setIsPlaying(engine.isSequencerPlaying());
            animationRef.current = requestAnimationFrame(updateState);
        };

        animationRef.current = requestAnimationFrame(updateState);
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, engine]);

    const toggleStep = (index: number) => {
        if (!engine) return;
        engine.toggleStep(index);
    };

    const handleRhythmModeChange = (mode: 'libre' | 'muineira' | 'ribeirada') => {
        if (!engine) return;
        engine.setRhythmMode(mode);
        setRhythmMode(mode);
    };

    const togglePlayback = () => {
        if (!engine) return;
        if (isPlaying) {
            engine.stopSequencer();
        } else {
            engine.startSequencer();
        }
        setIsPlaying(!isPlaying);
    };

    const regeneratePattern = () => {
        if (!engine) return;
        engine.generateRandomPattern();
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4 gap-6">
            {/* Title */}
            <div className="text-center">
                <h2 className={`text-2xl font-bold ${theme.accent} tracking-wider`}>
                    REIXA DA BRÉTEMA
                </h2>
                <p className={`text-xs ${theme.text} opacity-60 mt-1`}>
                    Secuenciador Generativo
                </p>
            </div>

            {/* Rhythm Mode Selector */}
            <div className="flex gap-2">
                {RHYTHM_MODES.map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => handleRhythmModeChange(mode.id)}
                        className={`px-3 py-1.5 text-xs rounded border transition-all ${rhythmMode === mode.id
                                ? `${theme.accent} border-current bg-white/10`
                                : `${theme.text} opacity-60 border-transparent hover:opacity-100`
                            }`}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Step Grid */}
            <div className="relative">
                {/* Fog overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none animate-pulse" />

                <div className="grid grid-cols-8 gap-2 p-4 bg-black/30 rounded-lg border border-white/10">
                    {steps.map((active, index) => {
                        const isCurrent = index === currentStep && isPlaying;
                        const prob = probabilities[index];

                        return (
                            <button
                                key={index}
                                onClick={() => toggleStep(index)}
                                className={`
                                    relative w-10 h-10 rounded-sm border transition-all duration-100
                                    ${active
                                        ? isCurrent
                                            ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.6)]'
                                            : 'bg-cyan-600/60 border-cyan-500/50'
                                        : isCurrent
                                            ? 'bg-white/20 border-white/40'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }
                                `}
                            >
                                {/* Probability indicator */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 bg-cyan-400/30"
                                    style={{ height: `${prob * 100}%` }}
                                />
                                {/* Step number */}
                                <span className="absolute inset-0 flex items-center justify-center text-xs opacity-40">
                                    {index + 1}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4">
                <button
                    onClick={togglePlayback}
                    className={`px-6 py-3 rounded-full border-2 transition-all font-bold tracking-wider ${isPlaying
                            ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
                            : `bg-cyan-500/20 border-cyan-500 ${theme.accent} hover:bg-cyan-500/30`
                        }`}
                >
                    {isPlaying ? '⏹ PARAR' : '▶ INICIAR'}
                </button>

                <button
                    onClick={regeneratePattern}
                    className={`px-4 py-3 rounded-full border ${theme.border} ${theme.text} opacity-70 hover:opacity-100 transition-all`}
                >
                    🎲 Rexenerar
                </button>
            </div>

            {/* VHS Scanlines effect */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
                style={{
                    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, black 2px, black 4px)'
                }}
            />
        </div>
    );
};

export default BreitemaUI;
