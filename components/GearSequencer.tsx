import React, { useRef, useEffect, useState } from 'react';
import { synthManager } from '../services/SynthManager';
import { Gear } from '../services/engines/GearheartEngine';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    type: 'smoke' | 'oil' | 'spark';
    color: string;
}

interface GearSequencerProps {
    diffusion?: number;
    gearConfig?: { numGears: number; arrangement: string } | null;
    onConfigApplied?: () => void;
}

const GearSequencer = ({ gearConfig, diffusion = 0.5, onConfigApplied }: GearSequencerProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const requestRef = useRef<number>(0);
    const dragInfo = useRef<{ id: number, offsetX: number, offsetY: number } | null>(null);
    const hasStartedAudio = useRef(false);

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

    // Sync Config to Engine (once, then notify parent to reset)
    useEffect(() => {
        const engine = synthManager.getGearheartEngine();
        if (engine && gearConfig) {
            engine.setGearConfig(gearConfig);
            // Notify parent to reset the config so it doesn't re-apply
            onConfigApplied?.();
        }
    }, [gearConfig, onConfigApplied]);

    const spawnSmoke = (x: number, y: number, amount: number) => {
        for (let i = 0; i < amount; i++) {
            const angle = (Math.random() - 0.5) * 0.5; // Narrower cone
            const speed = Math.random() * 0.5 + 0.2;
            particlesRef.current.push({
                x: x,
                y: y,
                vx: angle,
                vy: -Math.random() * 1.5 - 0.5,
                life: 1.0,
                maxLife: 1.0 + Math.random() * 0.5,
                size: Math.random() * 8 + 4,
                type: 'smoke',
                color: '200, 200, 200' // Store base color components
            });
        }
    };

    const spawnOil = (x: number, y: number) => {
        particlesRef.current.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: Math.random() * 1 + 0.5,
            life: 1.0,
            maxLife: 2.0,
            size: Math.random() * 2 + 1,
            type: 'oil',
            color: '40, 30, 20' // Dark oil color
        });
    };

    const getGradientColors = (material: string): [string, string, string] => {
        switch (material) {
            case 'bronze': return ['#cd7f32', '#8b4513', '#5a2e0c'];
            case 'copper': return ['#b87333', '#8b4513', '#4a2505'];
            case 'gold': return ['#ffd700', '#daa520', '#8b6914'];
            case 'platinum': return ['#e5e4e2', '#a9a9a9', '#696969'];
            case 'iron': return ['#71797E', '#4A4A4A', '#2F2F2F'];
            default: return ['#888', '#555', '#222'];
        }
    };

    const update = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            requestRef.current = requestAnimationFrame(update);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            requestRef.current = requestAnimationFrame(update);
            return;
        }

        // Background - Rusty Iron (always draw background)
        const bgGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width
        );
        bgGradient.addColorStop(0, '#2b1d14'); // Dark rusty brown
        bgGradient.addColorStop(0.6, '#1a120b');
        bgGradient.addColorStop(1, '#0f0a06');

        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const engine = synthManager.getGearheartEngine();
        if (!engine || !engine.isReady()) {
            // Engine not ready - continue loop but don't draw gears
            requestRef.current = requestAnimationFrame(update);
            return;
        }

        // Vibration/Shake from Engine - Enhanced for impact
        const vibration = engine.vibration;
        if (vibration > 0.1) {
            const shakeX = (Math.random() - 0.5) * vibration * 2;
            const shakeY = (Math.random() - 0.5) * vibration * 2;
            ctx.save();
            ctx.translate(shakeX, shakeY);
        } else {
            ctx.save();
        }

        const gears = engine.getGears();

        // Draw Gears
        gears.forEach(g => {
            // Mechanical Link Visualization
            if (g.isConnected) {
                gears.forEach(other => {
                    if (g.id !== other.id && other.isConnected && !g.isDragging && !other.isDragging) {
                        const dx = g.x - other.x;
                        const dy = g.y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < g.radius + other.radius + 18) {
                            ctx.beginPath();
                            ctx.moveTo(g.x, g.y);
                            ctx.lineTo(other.x, other.y);
                            ctx.strokeStyle = "rgba(100, 80, 50, 0.4)";
                            ctx.lineWidth = 10;
                            ctx.stroke();
                            ctx.strokeStyle = "rgba(180, 140, 90, 0.2)";
                            ctx.lineWidth = 4;
                            ctx.stroke();
                        }
                    }
                });
            }

            if (g.isConnected && Math.abs(g.speed) > 0.01) {
                // Smoke from connection points or top
                if (Math.random() < 0.01 * (diffusion || 0.5)) {
                    spawnSmoke(g.x, g.y - g.radius, 1);
                }
                // Oil leaks from moving gears - increased frequency
                if (Math.random() < 0.02) {
                    spawnOil(g.x + (Math.random() - 0.5) * g.radius, g.y + g.radius * 0.5);
                }
            }

            ctx.save();
            ctx.translate(g.x, g.y);
            ctx.rotate(g.angle);

            // Halo for Motor
            if (g.id === 0) {
                if (engine.isMotorActive) {
                    ctx.shadowColor = "#ff2200";
                    ctx.shadowBlur = 40 + Math.random() * 10;
                } else {
                    ctx.shadowColor = "rgba(100, 200, 255, 0.5)";
                    ctx.shadowBlur = 15;
                }
            } else if (g.isDragging) {
                ctx.shadowColor = "#ffbf69";
                ctx.shadowBlur = 20;
            } else {
                ctx.shadowBlur = 0;
            }

            // Material Gradients
            const [light, mid, dark] = getGradientColors(g.material);
            const gearGradient = ctx.createRadialGradient(0, 0, g.radius * 0.2, 0, 0, g.radius);
            gearGradient.addColorStop(0, light);
            gearGradient.addColorStop(0.5, mid);
            gearGradient.addColorStop(1, dark);

            ctx.fillStyle = gearGradient;

            // Draw Gear Teeth (3D effect)
            const outerRadius = g.radius;
            const innerRadius = g.radius - 8;

            ctx.beginPath();
            for (let i = 0; i < g.teeth * 2; i++) {
                const a = (Math.PI * 2 * i) / (g.teeth * 2);
                const r = (i % 2 === 0) ? outerRadius : innerRadius;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();

            // Inner rim stroke
            ctx.strokeStyle = dark;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Highlight reflection (Fake 3D)
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius - 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.fill();

            // Wooden Axle
            const axleRadius = 15;
            const woodGradient = ctx.createRadialGradient(0, 0, 2, 0, 0, axleRadius);
            woodGradient.addColorStop(0, '#8b5a2b'); // Light wood
            woodGradient.addColorStop(0.8, '#5c3a1e'); // Dark wood
            woodGradient.addColorStop(1, '#362312'); // Bark/Edge

            ctx.beginPath();
            ctx.arc(0, 0, axleRadius, 0, Math.PI * 2);
            ctx.fillStyle = woodGradient;
            ctx.fill();

            // Wood grain rings
            ctx.strokeStyle = "rgba(40, 20, 10, 0.3)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();

            // Center Bolt
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#b87333'; // Copper bolt
            ctx.fill();
            ctx.strokeStyle = '#4a2505';
            ctx.stroke();

            // Trigger Marker (Rivet)
            if (g.isConnected) {
                ctx.beginPath();
                ctx.arc(0, -innerRadius + 8, 4, 0, Math.PI * 2);
                const rivetGrad = ctx.createRadialGradient(0, -innerRadius + 8, 1, 0, -innerRadius + 8, 4);
                rivetGrad.addColorStop(0, '#fff');
                rivetGrad.addColorStop(1, '#555');
                ctx.fillStyle = rivetGrad;
                ctx.fill();
            }

            ctx.restore();
        });

        // Update and Draw Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.01;

            if (p.type === 'smoke') {
                p.size += 0.1;
                p.vx *= 0.95;
            } else {
                p.vy += 0.1;
            }

            if (p.life <= 0) {
                particlesRef.current.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

            if (p.type === 'smoke') {
                ctx.fillStyle = `rgba(${p.color}, ${p.life * 0.3})`;
            } else if (p.type === 'oil') {
                ctx.fillStyle = `rgba(${p.color}, ${p.life * 0.8})`;
            } else {
                ctx.fillStyle = `rgba(0, 0, 0, ${p.life})`;
            }

            ctx.fill();
        }

        // Restore from shake transform
        ctx.restore();

        requestRef.current = requestAnimationFrame(update);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    // --- INTERACTION LOGIC ---

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        // Prevent default on touch to avoid ghost mouse events
        if ('touches' in e && e.cancelable) {
            // e.preventDefault(); 
        }

        if (!hasStartedAudio.current) {
            synthManager.resume();
            hasStartedAudio.current = true;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Normalize coordinates
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const engine = synthManager.getGearheartEngine();
        if (!engine) return;

        const gears = engine.getGears();

        // 1. Check Draggable Gears FIRST
        const hitGears = [];
        for (let i = 0; i < gears.length; i++) {
            const g = gears[i];
            // Skip Motor (id 0) for drag check
            if (g.id === 0) continue;

            const dx = x - g.x;
            const dy = y - g.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < g.radius) {
                hitGears.push({ index: i, gear: g, distance: distance });
            }
        }

        if (hitGears.length > 0) {
            // We hit a draggable gear -> Start Dragging
            hitGears.sort((a, b) => a.gear.radius - b.gear.radius);
            const selected = hitGears[0];
            const g = selected.gear;
            const dx = x - g.x;
            const dy = y - g.y;

            dragInfo.current = { id: g.id, offsetX: dx, offsetY: dy };
            engine.updateGearPosition(g.id, g.x, g.y);
            return; // Stop here, don't check motor
        }

        // 2. If no gear hit, Check Motor (with expanded hitbox)
        const motor = gears[0];
        const dxMotor = x - motor.x;
        const dyMotor = y - motor.y;
        // Expanded Hitbox (1.2x)
        if (Math.sqrt(dxMotor * dxMotor + dyMotor * dyMotor) < motor.radius * 1.2) {
            engine.toggleMotor();
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!dragInfo.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const engine = synthManager.getGearheartEngine();
        if (!engine) return;

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const newX = x - dragInfo.current.offsetX;
        const newY = y - dragInfo.current.offsetY;

        engine.updateGearPosition(dragInfo.current.id, newX, newY);
    };

    const handleEnd = () => {
        const engine = synthManager.getGearheartEngine();
        if (engine && dragInfo.current) {
            engine.endDrag(dragInfo.current.id);
        }
        dragInfo.current = null;
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-[#1a120b] overflow-hidden">
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="touch-none cursor-pointer"
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
            />
            <div className="absolute bottom-4 text-[#cd7f32] text-[10px] font-mono pointer-events-none opacity-60 uppercase tracking-widest w-full text-center shadow-black drop-shadow-md">
                Arrastra as engrenaxes para acoplalas ao Motor | Mantén pulsado o Motor para deter/activar
            </div>
        </div>
    );
};

export default GearSequencer;