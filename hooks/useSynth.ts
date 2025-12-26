import { useState, useEffect, useRef } from 'react';
import { ParameterType, SynthState, PlanetaryCondition } from '../types';
import { synthManager } from '../services/SynthManager';
import { fetchTitanCondition } from '../services/GeminiService';
import { Preferences } from '@capacitor/preferences';

export const useSynth = (initialEngine: 'criosfera' | 'gearheart' | 'echo-vessel', apiKeyProp: string) => {
    const [currentEngine, setCurrentEngine] = useState(initialEngine);
    const [initializedEngines, setInitializedEngines] = useState<Set<string>>(new Set());
    const [isAiLoading, setIsAiLoading] = useState(false);

    const defaultSynthState: SynthState = {
        pressure: 0.7,
        resonance: 0.6,
        viscosity: 0.3,
        turbulence: 0.2,
        diffusion: 0.4,
    };

    const [engineStates, setEngineStates] = useState<Record<string, SynthState>>({
        'criosfera': { ...defaultSynthState },
        'gearheart': { ...defaultSynthState },
        'echo-vessel': { ...defaultSynthState }
    });

    const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({
        'criosfera': '',
        'gearheart': '',
        'echo-vessel': ''
    });

    const [titanReports, setTitanReports] = useState<Record<string, string>>({
        'criosfera': 'Sistema en espera...',
        'gearheart': 'Sistema en espera...',
        'echo-vessel': 'Sistema en espera...'
    });

    const [playingFrequencies, setPlayingFrequencies] = useState<Map<number, number>>(new Map());
    const activeNotesRef = useRef<Map<number, number>>(new Map());

    const state = engineStates[currentEngine] || defaultSynthState;
    const isCurrentActive = initializedEngines.has(currentEngine);
    const aiPrompt = aiPrompts[currentEngine] || '';
    const titanReport = titanReports[currentEngine] || '';

    const setState = (updater: SynthState | ((prev: SynthState) => SynthState)) => {
        setEngineStates(prev => ({
            ...prev,
            [currentEngine]: typeof updater === 'function' ? updater(prev[currentEngine]) : updater
        }));
    };

    const setAiPrompt = (value: string) => setAiPrompts(prev => ({ ...prev, [currentEngine]: value }));
    const setTitanReport = (value: string) => setTitanReports(prev => ({ ...prev, [currentEngine]: value }));

    useEffect(() => {
        if (isCurrentActive) {
            synthManager.updateParameters(state);
        }
    }, [state, currentEngine, isCurrentActive]);

    const handleStart = async () => {
        await synthManager.init();
        await synthManager.resume();
        setInitializedEngines(prev => new Set(prev).add(currentEngine));
    };

    const toggleEngine = async () => {
        if (isCurrentActive) {
            synthManager.stopActiveEngine();
            if (currentEngine === 'criosfera') {
                activeNotesRef.current.clear();
                setPlayingFrequencies(new Map());
            }
            setTitanReport('Sistema en espera...');
            setInitializedEngines(prev => {
                const next = new Set(prev);
                next.delete(currentEngine);
                return next;
            });
        } else {
            await handleStart();
            if (currentEngine === 'gearheart') {
                synthManager.getGearheartEngine()?.startPhysicsLoop();
            }
        }
    };

    const switchEngine = (engine: any) => {
        setCurrentEngine(engine);
        synthManager.switchEngine(engine);
    };

    const updateParam = (param: ParameterType, value: number) => {
        setState(prev => ({ ...prev, [param]: value }));
    };

    const toggleNote = (freq: number) => {
        if (!isCurrentActive) return;

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
        if (!aiPrompt || !apiKeyProp) return;
        setIsAiLoading(true);
        try {
            const condition = await fetchTitanCondition(aiPrompt, apiKeyProp);
            const clamp = (v: number) => Math.max(0, Math.min(1, v));

            const s = {
                turbulence: clamp(condition.stormLevel ?? 0.5),
                viscosity: clamp(condition.methaneDensity ?? 0.5),
                pressure: clamp(condition.temperature ?? 0.5),
                resonance: clamp(0.5 + ((condition.stormLevel ?? 0.5) * 0.5)),
                diffusion: clamp(0.3 + ((condition.methaneDensity ?? 0.5) * 0.4))
            };

            setState(prev => ({ ...prev, ...s }));
            const reportText = condition.description || "Transmutación completada.";
            setTitanReport(reportText);

            if (currentEngine === 'echo-vessel') {
                const echoEngine = synthManager.getEchoVesselEngine();
                if (echoEngine) {
                    echoEngine.setSpeechText(reportText);
                    echoEngine.speakOnce();
                }
            }
        } catch (err: any) {
            console.error("AI Patch Error:", err);
            setTitanReport(`Erro: ${err.message}`);
        } finally {
            setIsAiLoading(false);
        }
    };

    return {
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
        setTitanReport
    };
};
