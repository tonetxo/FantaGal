import React, { useEffect, useRef, useState } from 'react';
import { synthManager } from '../services/SynthManager';
import { EchoVesselEngine } from '../services/engines/EchoVesselEngine';

interface EchoVesselUIProps {
    isActive: boolean;
    engine: EchoVesselEngine | undefined;
    aiPrompt: string;
    onGenerate: () => void;
    hasApiKey: boolean;
    report: string;
    isAiLoading: boolean;
    onVialChange?: (vial: 'neutral' | 'mercury' | 'amber') => void;
}

const EchoVesselUI: React.FC<EchoVesselUIProps> = ({ isActive, engine, aiPrompt, onGenerate, hasApiKey, report, isAiLoading, onVialChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [micActive, setMicActive] = useState(false);
    const [selectedVial, setSelectedVial] = useState<'neutral' | 'mercury' | 'amber'>('neutral');

    // Canvas dimensions with resize handling
    const [dimensions, setDimensions] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 800,
        height: typeof window !== 'undefined' ? window.innerHeight * 0.6 : 480
    });

    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight * 0.6
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sync state from engine prop
    useEffect(() => {
        if (engine && isActive) {
            setMicActive(engine.getIsMicActive());
        }
    }, [engine, isActive]);

    // Handle Mic Toggle
    const toggleMic = async () => {
        if (!engine) return;

        if (micActive) {
            engine.setMicEnabled(false);
            setMicActive(false);
        } else {
            await synthManager.resume(); // Ensure AudioContext is running
            await engine.setMicEnabled(true);
            setMicActive(true);
        }
    };

    // Handle Vial Change
    const selectVial = (vial: 'neutral' | 'mercury' | 'amber') => {
        if (!engine) return;

        engine.setVial(vial);
        setSelectedVial(vial);
        onVialChange?.(vial); // Notify parent component
    };

    // Gyroscope Effect (Inertia)
    useEffect(() => {
        if (!isActive || !engine) return;

        const handleOrientation = (event: DeviceOrientationEvent) => {
            // Beta: front-back tilt [-180, 180] -> map to Z (Depth)
            // Gamma: left-right tilt [-90, 90] -> map to X (Pan)

            const x = (event.gamma || 0) / 45; // Normalize somewhat
            const y = (event.beta || 0) / 45;

            engine.setOrientation(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
        };

        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, [isActive, engine]);

    // Visualizer Loop
    useEffect(() => {
        if (!isActive) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Use a dummy array if engine not ready yet
        let analyser = engine ? engine.getAnalyser() : null;
        let dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 128);
        let animationId: number;

        const render = () => {
            animationId = requestAnimationFrame(render);

            // Try to get analyser again if we didn't have it
            if (!analyser && engine) {
                analyser = engine.getAnalyser();
                if (analyser) {
                    dataArray = new Uint8Array(analyser.frequencyBinCount);
                }
            }

            if (analyser) {
                analyser.getByteTimeDomainData(dataArray);
            } else {
                // If no analyser, fill with silence (128)
                dataArray.fill(128);
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const radius = Math.min(w, h) * 0.4;

            // Clear with trail
            ctx.fillStyle = 'rgba(10, 15, 20, 0.2)';
            ctx.fillRect(0, 0, w, h);

            // Draw Container Ring
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#334455';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw Plasma Wave
            ctx.beginPath();
            ctx.lineWidth = 4;

            let rBase = radius * 0.9;
            if (selectedVial === 'mercury') {
                ctx.strokeStyle = '#00ffff'; // Cyan
                ctx.shadowColor = '#00ffff';
            } else if (selectedVial === 'amber') {
                ctx.strokeStyle = '#ffaa00'; // Amber
                ctx.shadowColor = '#ffaa00';
            } else {
                ctx.strokeStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
            }
            ctx.shadowBlur = 15;

            for (let i = 0; i < dataArray.length; i++) {
                const v = dataArray[i] / 128.0; // 0..2 (1 is silence)
                const angle = (i / dataArray.length) * 2 * Math.PI;

                // Polar conversion with modulation
                const r = rBase + (v - 1) * 100; // Amplitude affects radius
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.shadowBlur = 0;
        };
        render();

        return () => cancelAnimationFrame(animationId);
    }, [isActive, engine, selectedVial]);

    // Typewriter & Speech State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [visibleText, setVisibleText] = useState("");
    const typeWriterRef = useRef<any>(null);

    // Reset visible text when report changes (new prophecy)
    useEffect(() => {
        if (report) setVisibleText(report); // Default to full text if not playing, or ready to play
    }, [report]);

    const toggleSpeech = async () => {
        if (!engine || !report) return;

        if (isSpeaking) {
            // STOP
            if (typeWriterRef.current) clearInterval(typeWriterRef.current);
            await engine.stopSpeech();
            setIsSpeaking(false);
            setVisibleText(report); // Show full text on stop
        } else {
            // PLAY
            setIsSpeaking(true);
            setVisibleText("");

            // Typewriter Animation
            let i = 0;
            const speed = 60; // ms per char
            typeWriterRef.current = setInterval(() => {
                setVisibleText(report.substring(0, i + 1));
                i++;
                if (i > report.length) clearInterval(typeWriterRef.current);
            }, speed);

            await engine.speakOnce();

            // Finished
            if (typeWriterRef.current) clearInterval(typeWriterRef.current);
            setVisibleText(report);
            setIsSpeaking(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#0a0f14] overflow-hidden">
            {/* Main Visualizer */}
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="absolute top-0 left-0 w-full h-full z-0 opacity-70"
            />

            {/* Central Text Display (Typewriter) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-12">
                <div className="max-w-xs text-center">
                    <p className="font-mono text-cyan-400/90 text-sm md:text-base tracking-widest drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] leading-loose uppercase">
                        {visibleText || (report ? "" : "Esperando Materia...")}
                        {isSpeaking && <span className="animate-pulse">_</span>}
                    </p>
                </div>
            </div>

            {/* Header / Info - Reduced */}
            <div className="absolute top-4 w-full text-center z-10 pointer-events-none">
                <h2 className="text-cyan-900 font-mono tracking-[0.5em] text-[10px] uppercase opacity-60">ECHO VESSEL</h2>
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-8 w-full max-w-md px-8 z-20 flex flex-col gap-6">

                {/* Input Controls */}
                <div className="flex justify-center gap-8">
                    <button
                        onClick={toggleMic}
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${micActive
                            ? 'border-red-500 bg-red-900/30 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                            : 'border-slate-700 text-slate-700 bg-black/40 backdrop-blur-sm'
                            }`}
                    >
                        <span className="material-icons text-2xl">🎤</span>
                    </button>

                    <button
                        onClick={toggleSpeech}
                        disabled={!report}
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all backdrop-blur-sm ${isSpeaking
                            ? 'border-amber-500 bg-amber-900/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
                            : report
                                ? 'border-cyan-500 bg-cyan-900/30 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:bg-cyan-900/50'
                                : 'border-slate-800 text-slate-800 opacity-30'
                            }`}
                    >
                        <span className="text-2xl">{isSpeaking ? '⬛' : '🔊'}</span>
                    </button>
                </div>

                {/* Vial Selectors (unchanged logic, just layout context) */}
                <div className="flex justify-between items-center bg-black/40 p-2 rounded-full border border-slate-800 backdrop-blur-sm">
                    <button
                        onClick={() => selectVial('mercury')}
                        className={`flex-1 py-3 rounded-full text-xs uppercase tracking-widest transition-all ${selectedVial === 'mercury'
                            ? 'bg-cyan-900/50 text-cyan-400 shadow-inner'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        Mercurio
                    </button>
                    <div className="w-px h-6 bg-slate-800"></div>
                    <button
                        onClick={() => selectVial('neutral')}
                        className={`flex-1 py-3 rounded-full text-xs uppercase tracking-widest transition-all ${selectedVial === 'neutral'
                            ? 'bg-slate-800 text-white shadow-inner'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        Neutro
                    </button>
                    <div className="w-px h-6 bg-slate-800"></div>
                    <button
                        onClick={() => selectVial('amber')}
                        className={`flex-1 py-3 rounded-full text-xs uppercase tracking-widest transition-all ${selectedVial === 'amber'
                            ? 'bg-amber-900/50 text-amber-400 shadow-inner'
                            : 'text-slate-600 hover:text-slate-400'
                            }`}
                    >
                        Ámbar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EchoVesselUI;
