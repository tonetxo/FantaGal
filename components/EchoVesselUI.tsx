import React, { useEffect, useRef, useState } from 'react';
import { synthManager } from '../services/SynthManager';
import { EchoVesselEngine } from '../services/engines/EchoVesselEngine';

interface EchoVesselUIProps {
    isActive: boolean;
    aiPrompt: string;
    onGenerate: () => void;
    hasApiKey: boolean;
    report: string;
}

const EchoVesselUI: React.FC<EchoVesselUIProps> = ({ isActive, aiPrompt, onGenerate, hasApiKey, report }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [engine, setEngine] = useState<EchoVesselEngine | null>(null);
    const [micActive, setMicActive] = useState(false);
    const [speechActive, setSpeechActive] = useState(false);
    const [selectedVial, setSelectedVial] = useState<'neutral'|'mercury'|'amber'>('neutral');

    // Init Engine Link
    useEffect(() => {
        const eng = synthManager.getEchoVesselEngine();
        if (eng) {
            setEngine(eng);
            setMicActive(eng.getIsMicActive());
            setSpeechActive(eng.getIsSpeechActive());
        }
    }, [isActive]);

    // Handle Mic Toggle
    const toggleMic = async () => {
        if (!engine) return;
        if (micActive) {
            engine.stopMic();
            setMicActive(false);
        } else {
            await synthManager.resume(); // Ensure AudioContext is running
            await engine.startMic();
            setMicActive(true);
        }
    };

    // Handle Speech Toggle
    const toggleSpeech = () => {
        if (!engine) return;
        if (speechActive) {
            engine.toggleSpeechLoop(false);
            setSpeechActive(false);
        } else {
            // Use current report as seed text or default incantation
            const text = report || "Echo Vessel. Transmutation initialized. The plasma flows.";
            engine.setSpeechText(text);
            engine.toggleSpeechLoop(true);
            setSpeechActive(true);
        }
    };

    // Handle Vial Change
    const selectVial = (vial: 'neutral'|'mercury'|'amber') => {
        if (!engine) return;
        engine.setVial(vial);
        setSelectedVial(vial);
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
        if (!isActive || !engine) return;
        const analyser = engine.getAnalyser();
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let animationId: number;

        const render = () => {
            animationId = requestAnimationFrame(render);
            analyser.getByteTimeDomainData(dataArray);

            const canvas = canvasRef.current;
            if (!canvas) return;
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

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; // 0..2 (1 is silence)
                const angle = (i / bufferLength) * 2 * Math.PI;
                
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

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#0a0f14] overflow-hidden">
            {/* Main Visualizer */}
            <canvas 
                ref={canvasRef} 
                width={window.innerWidth} 
                height={window.innerHeight * 0.6}
                className="absolute top-0 left-0 w-full h-full z-0"
            />
            
            {/* Header / Info */}
            <div className="absolute top-4 w-full text-center z-10 pointer-events-none">
                <h2 className="text-cyan-500 font-mono tracking-[0.5em] text-xs uppercase opacity-80">ECHO VESSEL</h2>
                <p className="text-xs text-slate-500 mt-1 font-mono">{report ? "Invocación Activa" : "Esperando Materia..."}</p>
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-8 w-full max-w-md px-8 z-20 flex flex-col gap-6">
                
                {/* Input Controls */}
                <div className="flex justify-center gap-8">
                    <button 
                        onClick={toggleMic}
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                            micActive 
                            ? 'border-red-500 bg-red-900/30 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                            : 'border-slate-700 text-slate-700'
                        }`}
                    >
                        <span className="material-icons text-2xl">🎤</span>
                    </button>

                    <button 
                        onClick={toggleSpeech}
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                            speechActive 
                            ? 'border-purple-500 bg-purple-900/30 text-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                            : 'border-slate-700 text-slate-700'
                        }`}
                    >
                         <span className="text-xl font-bold">AI</span>
                    </button>
                </div>

                {/* Vial Selectors */}
                <div className="flex justify-between items-center bg-black/40 p-2 rounded-full border border-slate-800 backdrop-blur-sm">
                    <button 
                        onClick={() => selectVial('mercury')}
                        className={`flex-1 py-3 rounded-full text-xs uppercase tracking-widest transition-all ${
                            selectedVial === 'mercury' 
                            ? 'bg-cyan-900/50 text-cyan-400 shadow-inner' 
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                    >
                        Mercurio
                    </button>
                    <div className="w-px h-6 bg-slate-800"></div>
                    <button 
                         onClick={() => selectVial('neutral')}
                         className={`flex-1 py-3 rounded-full text-xs uppercase tracking-widest transition-all ${
                            selectedVial === 'neutral' 
                            ? 'bg-slate-800 text-white shadow-inner' 
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                    >
                        Neutro
                    </button>
                    <div className="w-px h-6 bg-slate-800"></div>
                    <button 
                        onClick={() => selectVial('amber')}
                        className={`flex-1 py-3 rounded-full text-xs uppercase tracking-widest transition-all ${
                            selectedVial === 'amber' 
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
