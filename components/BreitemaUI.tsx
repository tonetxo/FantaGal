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
    const [fogDensity, setFogDensity] = useState(0.5);
    const [fogMovement, setFogMovement] = useState(0.2);
    const [fmDepth, setFmDepth] = useState(100);
    const [lastTriggerStep, setLastTriggerStep] = useState(-1);
    const [interactFlash, setInteractFlash] = useState(0);
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
            setFogDensity(state.fogDensity);
            setFogMovement(state.fogMovement);
            setFmDepth(state.fmDepth);

            // Check if a note was just triggered (at the start of a step)
            if (state.steps[state.currentStep] && state.currentStep !== lastTriggerStep) {
                setLastTriggerStep(state.currentStep);
            }

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
        // Trigger a visual interaction flash
        setInteractFlash(v => v + 1);
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
        <div className="flex flex-col items-center justify-between h-full w-full p-4 pt-24">
            {/* Rhythm Mode Selector - Top */}
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

            {/* Step Grid - Center with more space */}
            <div className="relative flex-1 flex items-center justify-center py-8">
                {/* Fog overlay effect - Dynamic & Interactive */}
                <div
                    className="absolute inset-x-[-30%] inset-y-[-20%] pointer-events-none overflow-hidden blur-3xl transition-all duration-700"
                    style={{
                        opacity: fogDensity * (0.4 + (isPlaying && steps[currentStep] ? 0.4 : 0)),
                        filter: `blur(${30 + fogDensity * 20}px) contrast(${1 + fogDensity})`,
                    }}
                >
                    {/* Primary Fog Layer - Base Color */}
                    <div
                        className="absolute inset-0 transition-colors duration-1000"
                        style={{
                            background: `radial-gradient(circle at 50% 50%, 
                                ${fmDepth > 250 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(34, 211, 238, 0.2)'} 0%, 
                                ${fmDepth > 400 ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0, 255, 255, 0.1)'} 50%, 
                                transparent 70%)`,
                            animation: `fogMove ${10 / (0.1 + fogMovement)}s infinite alternate ease-in-out`
                        }}
                    />

                    {/* Turbulence Layer - Reactive to movement */}
                    <div
                        className="absolute inset-0 opacity-50 transition-transform duration-500"
                        style={{
                            background: 'conic-gradient(from 0deg at 50% 50%, transparent, rgba(34, 211, 238, 0.1), transparent)',
                            transform: `rotate(${currentStep * 22.5}deg) scale(${1 + fogMovement})`,
                            animation: `fogSpin ${20 / (0.1 + fogMovement)}s infinite linear`
                        }}
                    />

                    {/* Interaction Ripple/Flash */}
                    <div
                        key={interactFlash}
                        className="absolute inset-0 bg-white/20 animate-ping opacity-0"
                        style={{ animationIterationCount: 1, animationDuration: '0.8s' }}
                    />
                </div>

                <style>{`
                    @keyframes fogMove {
                        0% { transform: translate(-10%, -5%) rotate(0deg) scale(1.1); }
                        100% { transform: translate(10%, 10%) rotate(8deg) scale(1.3); }
                    }
                    @keyframes fogSpin {
                        from { transform: rotate(0deg) scale(1.2); }
                        to { transform: rotate(360deg) scale(1.2); }
                    }
                `}</style>

                <div className="grid grid-cols-4 gap-4 p-4 bg-black/40 rounded-lg border border-white/10 relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    {steps.map((active, index) => {
                        const isCurrent = index === currentStep && isPlaying;
                        const prob = probabilities[index];

                        return (
                            <button
                                key={index}
                                onClick={() => toggleStep(index)}
                                className={`
                                    relative w-14 h-14 rounded-md border transition-all duration-100
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

            {/* Controls - Bottom */}
            <div className="flex gap-4 pb-4">
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
