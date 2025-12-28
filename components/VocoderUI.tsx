import React, { useRef, useEffect, useState } from 'react';
import { synthManager } from '../services/SynthManager';
import { VocoderEngine } from '../services/engines/VocoderEngine';
import { useCanvasDimensions } from '../hooks/useCanvasDimensions';

interface Particle {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    size: number;
    color: { r: number; g: number; b: number };
    type: 'stalactite' | 'fluid' | 'spark';
}

interface VocoderUIProps {
    isActive: boolean;
    engine: VocoderEngine | undefined;
}

const VocoderUI: React.FC<VocoderUIProps> = ({ isActive, engine }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const [status, setStatus] = useState<'idle' | 'recording' | 'playing'>('idle');

    // Audio analysis state
    const audioDataRef = useRef<number[]>(Array(12).fill(0)); // 12 bands
    const lastUpdateRef = useRef<number>(0);
    const concentricWavesRef = useRef<Array<{ radius: number, intensity: number, frequency: number }>>([]);

    // Canvas dimensions with resize handling
    const dimensions = useCanvasDimensions(0.6);

    // Sync state from engine prop and connect carriers
    useEffect(() => {
        if (engine && isActive) {
            if (engine.getIsRecording()) setStatus('recording');
            else if (engine.getIsPlayingBuffer()) setStatus('playing');
            else setStatus('idle');

            // Connect external carrier sources (Criosfera / Gearheart)
            // This is crucial for the vocoder to modulate the synth sound
            const criosferaTap = synthManager.getEngineTap('criosfera');
            const gearheartTap = synthManager.getEngineTap('gearheart');
            engine.setCarrierSources(criosferaTap, gearheartTap);
        } else {
            setStatus('idle');
            // Disconnect sources when inactive to save resources
            if (engine) {
                engine.setCarrierSources(null, null);
            }
        }
    }, [engine, isActive]);

    // Handle Mic/Record Toggle
    const toggleMic = async () => {
        if (!engine || !isActive) return;

        if (status === 'idle') {
            await synthManager.resume();
            await engine.startRecording();
            setStatus('recording');
        } else if (status === 'recording') {
            engine.stopRecording();
            setStatus('playing');
        } else { // Playing
            engine.stopPlayback();
            setStatus('idle');
        }
    };

    // Main render loop
    useEffect(() => {
        if (!isActive) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;

        const render = () => {
            animationId = requestAnimationFrame(render);

            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const time = Date.now() * 0.001;

            // Get audio data from engine
            if (engine && status === 'playing') {
                const analysers = engine.getBandAnalysers();
                const newAudioData: number[] = [];

                analysers.forEach((analyser, i) => {
                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteTimeDomainData(dataArray);

                    // Calculate RMS amplitude for this band
                    let sum = 0;
                    for (let j = 0; j < dataArray.length; j++) {
                        const normalized = (dataArray[j] - 128) / 128;
                        sum += normalized * normalized;
                    }
                    let rms = Math.sqrt(sum / dataArray.length);

                    // Safety: prevent NaN/Infinity from audio glitches
                    if (!isFinite(rms) || isNaN(rms)) rms = 0;
                    newAudioData[i] = rms;
                });

                // Smooth the audio data
                for (let i = 0; i < newAudioData.length; i++) {
                    audioDataRef.current[i] = audioDataRef.current[i] * 0.7 + newAudioData[i] * 0.3;
                }
            }

            // Update concentric waves
            concentricWavesRef.current = concentricWavesRef.current
                .map(wave => ({
                    ...wave,
                    radius: wave.radius + (wave.frequency * 2),
                    intensity: wave.intensity * 0.95
                }))
                .filter(wave => wave.intensity > 0.01);

            // Add new waves based on audio activity
            let totalAmplitude = audioDataRef.current.reduce((sum, val) => sum + val, 0) / audioDataRef.current.length;
            if (!isFinite(totalAmplitude) || isNaN(totalAmplitude)) totalAmplitude = 0;

            if (totalAmplitude > 0.1 && Math.random() < totalAmplitude * 5) {
                const totalVal = audioDataRef.current.reduce((sum, val) => sum + val, 0);
                const weightSum = audioDataRef.current.reduce((sum, val, idx) => sum + val * idx, 0);
                const avgFreq = totalVal > 0.001 ? weightSum / totalVal : 0;

                concentricWavesRef.current.push({
                    radius: 50,
                    intensity: totalAmplitude,
                    frequency: 2 + (isFinite(avgFreq) ? avgFreq : 0) * 3
                });
            }

            // Clear with cave-like background
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2);
            gradient.addColorStop(0, 'rgba(5, 10, 15, 0.9)');
            gradient.addColorStop(0.7, 'rgba(10, 20, 15, 0.7)');
            gradient.addColorStop(1, 'rgba(0, 5, 10, 0.9)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);

            // Draw cave walls with depth effect
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            for (let i = 0; i < 50; i++) {
                const angle = (i / 50) * Math.PI * 2;
                const distance = 100 + Math.sin(time * 0.5 + i * 0.3) * 20;
                const x = cx + Math.cos(angle) * distance;
                const y = cy + Math.sin(angle) * distance;

                const size = 5 + Math.sin(time * 2 + i) * 3;
                const alpha = 0.1 + Math.sin(time * 0.3 + i) * 0.05;

                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(20, 100, 80, ${alpha})`;
                ctx.fill();
            }
            ctx.restore();

            // Draw concentric waves
            concentricWavesRef.current.forEach(wave => {
                const radius = wave.radius;
                const intensity = wave.intensity;

                if (radius < Math.min(w, h) / 2) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(100, 255, 200, ${intensity * 0.4})`;
                    ctx.lineWidth = 2 + intensity * 4;
                    ctx.stroke();

                    // Inner glow
                    ctx.beginPath();
                    ctx.arc(cx, cy, Math.max(0.1, radius - 2), 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(50, 200, 150, ${intensity * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });

            // Draw spectral bars around the edge
            const barCount = audioDataRef.current.length;
            for (let i = 0; i < barCount; i++) {
                const amplitude = audioDataRef.current[i];
                const angle = (i / barCount) * Math.PI * 2;
                const innerRadius = Math.min(w, h) * 0.35;
                const outerRadius = innerRadius + amplitude * 50;

                const x1 = cx + Math.cos(angle) * innerRadius;
                const y1 = cy + Math.sin(angle) * innerRadius;
                const x2 = cx + Math.cos(angle) * outerRadius;
                const y2 = cy + Math.sin(angle) * outerRadius;

                // Color based on frequency band (green to blue)
                const hue = 120 + (i / barCount) * 60; // Green to cyan
                ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.3 + amplitude * 0.7})`;
                ctx.lineWidth = 3 + amplitude * 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }

            // Draw central crystal formation
            const crystalSize = 30 + totalAmplitude * 40;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time * 0.5);

            // Crystal core
            const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, crystalSize);
            coreGradient.addColorStop(0, `rgba(100, 255, 200, ${0.3 + totalAmplitude * 0.4})`);
            coreGradient.addColorStop(0.5, `rgba(50, 200, 150, ${0.2 + totalAmplitude * 0.3})`);
            coreGradient.addColorStop(1, `rgba(20, 100, 80, 0.1)`);

            ctx.fillStyle = coreGradient;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const x = Math.cos(angle) * crystalSize;
                const y = Math.sin(angle) * crystalSize;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();

            // Crystal glow
            ctx.shadowColor = 'rgba(100, 255, 200, 0.8)';
            ctx.shadowBlur = 20 + totalAmplitude * 30;
            ctx.strokeStyle = `rgba(100, 255, 200, ${0.5 + totalAmplitude * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Draw floating particles that respond to audio
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];

                // Update position
                p.x += p.vx;
                p.y += p.vy;
                p.z += p.vz;
                p.life -= 0.005;

                // Physics
                if (p.type === 'stalactite') {
                    p.vy += 0.05; // Gravity
                } else if (p.type === 'fluid') {
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    p.vz *= 0.98;
                }

                // Remove dead particles
                if (p.life <= 0 || p.y > h + 50 || p.x < -50 || p.x > w + 50) {
                    particlesRef.current.splice(i, 1);
                    continue;
                }

                // 3D projection (simple perspective) - clamp z to prevent negative scale
                const safeZ = Math.max(p.z, -180); // Prevent z from making scale negative
                const scale = 200 / (200 + safeZ);
                const screenX = p.x * scale + (1 - scale) * w / 2;
                const screenY = p.y * scale + (1 - scale) * h / 2;
                const screenSize = Math.max(0.1, p.size * scale); // Ensure positive size

                // Draw particle
                const alpha = p.life * 0.8;
                ctx.beginPath();
                ctx.arc(screenX, screenY, screenSize, 0, Math.PI * 2);

                // Glow effect
                const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenSize * 2);
                gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.5})`);
                gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);

                ctx.fillStyle = gradient;
                ctx.fill();
            }

            // Spawn new particles based on audio activity
            if (status === 'playing') {
                const avgAmplitude = audioDataRef.current.reduce((sum, val) => sum + val, 0) / audioDataRef.current.length;
                if (avgAmplitude > 0.05 && Math.random() < avgAmplitude * 10) {
                    // Create particles that respond to the average audio amplitude
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 50 + Math.random() * 100;
                    const x = cx + Math.cos(angle) * distance;
                    const y = cy + Math.sin(angle) * distance;

                    particlesRef.current.push({
                        x: x,
                        y: y,
                        z: Math.random() * 100,
                        vx: Math.cos(angle + Math.PI) * avgAmplitude * 3,
                        vy: Math.sin(angle + Math.PI) * avgAmplitude * 3,
                        vz: (Math.random() - 0.5) * 2,
                        life: 0.5 + Math.random() * 1.0,
                        maxLife: 1.5,
                        size: 1 + avgAmplitude * 8,
                        color: {
                            r: 100 + Math.floor(avgAmplitude * 100),
                            g: 200 + Math.floor(avgAmplitude * 55),
                            b: 150 + Math.floor(avgAmplitude * 105)
                        },
                        type: Math.random() > 0.5 ? 'fluid' : 'spark'
                    });
                }
            }
        };

        render();

        return () => cancelAnimationFrame(animationId);
    }, [isActive, engine, status]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1117] overflow-hidden relative">
            {/* Canvas Visualization */}
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="absolute top-0 left-0 w-full h-full z-0"
            />

            {/* Header */}
            <div className="absolute top-4 w-full text-center z-10 pointer-events-none">
                <h2 className="text-emerald-900 font-mono tracking-[0.5em] text-[10px] uppercase opacity-60">
                    Vocoder das Covas
                </h2>
            </div>

            {/* Controls Overlay */}
            <div className={`absolute bottom-8 w-full max-w-lg px-4 z-20 flex flex-col gap-6 transition-opacity duration-500 ${!isActive ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                {/* Microphone Control */}
                <div className="flex justify-center">
                    <button
                        onClick={toggleMic}
                        className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all ${status === 'recording'
                            ? 'border-red-500 bg-red-900/30 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
                            : status === 'playing'
                                ? 'border-emerald-500 bg-emerald-900/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                : 'border-emerald-800 text-emerald-700 bg-black/40 backdrop-blur-sm'
                            }`}
                    >
                        <span className="text-3xl">
                            {status === 'recording' ? '⏹️' : status === 'playing' ? '🔄' : '🎤'}
                        </span>
                    </button>
                </div>

                {/* Info Text */}
                <div className="text-center text-emerald-500/60 text-xs font-mono uppercase tracking-widest">
                    {status === 'recording' ? 'Gravando Audio...' :
                        status === 'playing' ? 'Modulando as Covas...' :
                            'Gravar Micrófono'}
                </div>
            </div>
        </div>
    );
};

export default VocoderUI;
