import React, { useRef, useEffect } from 'react';
import { synthManager } from '../services/SynthManager';

interface Gear {
  id: number;
  x: number;
  y: number;
  radius: number;
  teeth: number;
  angle: number;
  speed: number;
  isDragging: boolean;
  isConnected: boolean; // Se está tocando a outra que xira
  material: 'bronze' | 'copper' | 'gold' | 'platinum' | 'iron';
}

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
    onTrigger: (pitch: number) => void;
    speedMultiplier?: number;
    diffusion?: number;
    turbulence?: number;
    gearConfig?: { numGears: number; arrangement: string } | null;
}

const GearSequencer = ({ onTrigger, speedMultiplier = 1, diffusion = 0.5, turbulence = 0.5, gearConfig }: GearSequencerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use refs for state that changes every frame (physics) to avoid React renders
  const gearsRef = useRef<Gear[]>([
    { id: 0, x: 150, y: 300, radius: 60, teeth: 12, angle: 0, speed: 0.02, isDragging: false, isConnected: true, material: 'iron' }, // Motor
    { id: 1, x: 300, y: 200, radius: 40, teeth: 8, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'bronze' },
    { id: 2, x: 100, y: 150, radius: 30, teeth: 6, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'copper' },
    { id: 3, x: 250, y: 400, radius: 50, teeth: 10, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'gold' },
    { id: 4, x: 200, y: 100, radius: 25, teeth: 5, angle: 0, speed: 0, isDragging: false, isConnected: false, material: 'platinum' },
  ]);

  const particlesRef = useRef<Particle[]>([]);
  const vibrationRef = useRef<number>(0);

  // Keep props in refs
  const speedMultRef = useRef(speedMultiplier);
  const diffusionRef = useRef(diffusion);
  const turbulenceRef = useRef(turbulence);

  useEffect(() => {
    speedMultRef.current = speedMultiplier;
    diffusionRef.current = diffusion;
    turbulenceRef.current = turbulence;
  }, [speedMultiplier, diffusion, turbulence]);

  // Procedural Generation based on AI Config
  useEffect(() => {
      if (!gearConfig) return;

      const newGears: Gear[] = [];
      const width = window.innerWidth;
      const height = window.innerHeight * 0.6;
      const centerX = width / 2;
      const centerY = height / 2;

      // Always add Motor first
      newGears.push({ 
          id: 0, 
          x: centerX, 
          y: height - 100, 
          radius: 60, 
          teeth: 12, 
          angle: 0, 
          speed: 0.02, 
          isDragging: false, 
          isConnected: true, 
          material: 'iron' 
      });

      const count = Math.max(3, Math.min(8, gearConfig.numGears));
      const materials: ('bronze' | 'copper' | 'gold' | 'platinum')[] = ['bronze', 'copper', 'gold', 'platinum'];

      for (let i = 1; i < count; i++) {
          let x, y, r;
          
          if (gearConfig.arrangement === 'linear') {
              x = (width / (count + 1)) * (i + 1);
              y = centerY;
              r = 30 + Math.random() * 20;
          } else if (gearConfig.arrangement === 'cluster') {
              const angle = (Math.PI * 2 * i) / count;
              x = centerX + Math.cos(angle) * 100;
              y = centerY + Math.sin(angle) * 100;
              r = 25 + Math.random() * 25;
          } else { // chaotic
              x = Math.random() * (width - 100) + 50;
              y = Math.random() * (height - 100) + 50;
              r = 20 + Math.random() * 40;
          }

          newGears.push({
              id: i,
              x: x,
              y: y,
              radius: r,
              teeth: Math.floor(r / 5),
              angle: 0,
              speed: 0,
              isDragging: false,
              isConnected: false,
              material: materials[i % materials.length]
          });
      }

      gearsRef.current = newGears;

  }, [gearConfig]);

  const requestRef = useRef<number>(0);
  const dragInfo = useRef<{ id: number, offsetX: number, offsetY: number } | null>(null);
  const isMotorActive = useRef<boolean>(true); 
  const motorTogglePending = useRef<boolean>(false);
  const hasStartedAudio = useRef(false);

  const spawnSmoke = (x: number, y: number, amount: number) => {
    for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.5 + 0.2;
        particlesRef.current.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: -Math.random() * 2 - 0.5, // Upwards
            life: 1.0,
            maxLife: 1.0 + Math.random() * 0.5,
            size: Math.random() * 5 + 2,
            type: 'smoke',
            color: `rgba(200, 200, 200, ${0.1 + diffusionRef.current * 0.2})`
        });
    }
  };

  const spawnOil = (x: number, y: number) => {
      particlesRef.current.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2 + 1, // Downwards
          life: 1.0,
          maxLife: 0.8,
          size: Math.random() * 3 + 1,
          type: 'oil',
          color: '#000000'
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background - Rusty Iron
    const bgGradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
    );
    bgGradient.addColorStop(0, '#2b1d14'); // Dark rusty brown
    bgGradient.addColorStop(0.6, '#1a120b');
    bgGradient.addColorStop(1, '#0f0a06');
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vibration/Shake
    if (vibrationRef.current > 0.1) {
        const shakeX = (Math.random() - 0.5) * vibrationRef.current;
        const shakeY = (Math.random() - 0.5) * vibrationRef.current;
        ctx.save();
        ctx.translate(shakeX, shakeY);
        vibrationRef.current *= 0.9;
    } else {
        ctx.save();
    }

    const gears = gearsRef.current; 

    // Update Motor State
    gears[0].isConnected = isMotorActive.current;
    gears[0].speed = isMotorActive.current ? 0.02 * speedMultRef.current : 0;

    // Reset non-motors
    for (let i = 1; i < gears.length; i++) {
        if (gears[i].isDragging) {
            gears[i].isConnected = false;
            gears[i].speed = 0;
        } else {
            gears[i].isConnected = false;
            gears[i].speed = 0;
        }
    }

    // Propagate Energy
    let changed = true;
    let iterations = 0;
    while(changed && iterations < 10) {
        changed = false;
        iterations++;

        for (let i = 0; i < gears.length; i++) {
            if (!gears[i].isConnected) continue;

            if (Math.abs(gears[i].speed) > 0.05 && Math.random() < 0.05 * turbulenceRef.current) {
                const angle = Math.random() * Math.PI * 2;
                spawnOil(
                    gears[i].x + Math.cos(angle) * gears[i].radius, 
                    gears[i].y + Math.sin(angle) * gears[i].radius
                );
            }

            for (let j = 0; j < gears.length; j++) {
                if (i === j) continue;
                if (gears[j].isDragging) continue;
                if (gears[j].isConnected) continue;

                const dx = gears[i].x - gears[j].x;
                const dy = gears[i].y - gears[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const combinedRadius = gears[i].radius + gears[j].radius;
                const margin = 12;

                if (dist < combinedRadius + margin) {
                    gears[j].isConnected = true;
                    gears[j].speed = -gears[i].speed * (gears[i].radius / gears[j].radius);

                    // Mechanical Link Visualization
                    ctx.beginPath();
                    ctx.moveTo(gears[i].x, gears[i].y);
                    ctx.lineTo(gears[j].x, gears[j].y);
                    ctx.strokeStyle = "rgba(100, 80, 50, 0.4)";
                    ctx.lineWidth = 10;
                    ctx.stroke();
                    ctx.strokeStyle = "rgba(180, 140, 90, 0.2)";
                    ctx.lineWidth = 4;
                    ctx.stroke();

                    changed = true;
                }
            }
        }
    }

    // Draw Gears
    gears.forEach(g => {
        if (g.isConnected) {
            const prevAngle = g.angle;
            g.angle += g.speed;

            const normPrev = Math.abs(prevAngle % (Math.PI * 2));
            const normCurr = Math.abs(g.angle % (Math.PI * 2));

            // Trigger
            if (normCurr < normPrev && Math.abs(normCurr - normPrev) > 0.1) {
                 if (hasStartedAudio.current) {
                    onTrigger(g.radius);
                    
                    // Trigger shake
                    vibrationRef.current += (g.id === 0 ? 10 : 3);
                    if (vibrationRef.current > 15) vibrationRef.current = 15;

                    const smokeAmount = 5 + Math.floor(diffusionRef.current * 10);
                    spawnSmoke(g.x, g.y - g.radius, smokeAmount);
                 }
            }
        }

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);

        // Halo for Motor
        if (g.id === 0) {
            if (isMotorActive.current) {
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
             ctx.fillStyle = p.color.replace(')', `, ${p.life * 0.4})`); 
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

  const handleStart = (clientX: number, clientY: number) => {
    if (!hasStartedAudio.current) {
        synthManager.resume();
        hasStartedAudio.current = true;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const gears = gearsRef.current;
    const motor = gears[0];
    const dxMotor = x - motor.x;
    const dyMotor = y - motor.y;
    if (Math.sqrt(dxMotor*dxMotor + dyMotor*dyMotor) < motor.radius) {
        motorTogglePending.current = true;
        return;
    }

    const hitGears = [];
    for (let i = 0; i < gears.length; i++) {
        const g = gears[i];
        const dx = x - g.x;
        const dy = y - g.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < g.radius && g.id !== 0) {
            hitGears.push({ index: i, gear: g, distance: distance });
        }
    }

    if (hitGears.length > 0) {
        hitGears.sort((a, b) => a.gear.radius - b.gear.radius);
        const selected = hitGears[0];
        const g = selected.gear;
        const dx = x - g.x;
        const dy = y - g.y;

        dragInfo.current = { id: g.id, offsetX: dx, offsetY: dy };
        gears[selected.index].isDragging = true;
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!dragInfo.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const gears = gearsRef.current;
    const gearIndex = gears.findIndex(g => g.id === dragInfo.current?.id);
    if (gearIndex !== -1) {
        gears[gearIndex].x = x - dragInfo.current.offsetX;
        gears[gearIndex].y = y - dragInfo.current.offsetY;
        gears[gearIndex].isDragging = true;
    }
  };

  const handleEnd = () => {
    const gears = gearsRef.current;
    if (motorTogglePending.current && !dragInfo.current) {
        isMotorActive.current = !isMotorActive.current;
        gears[0].isConnected = isMotorActive.current;
        gears[0].speed = isMotorActive.current ? 0.02 * speedMultRef.current : 0;
    }

    if (dragInfo.current) {
        const gearIndex = gears.findIndex(g => g.id === dragInfo.current?.id);
        if (gearIndex !== -1) {
            gears[gearIndex].isDragging = false;
        }
        dragInfo.current = null;
    }

    motorTogglePending.current = false;
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a120b] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight * 0.6}
        className="touch-none cursor-pointer"
        onMouseDown={e => handleStart(e.clientX, e.clientY)}
        onMouseMove={e => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={e => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleEnd}
      />
      <div className="absolute bottom-4 text-[#cd7f32] text-[10px] font-mono pointer-events-none opacity-60 uppercase tracking-widest w-full text-center shadow-black drop-shadow-md">
        Arrastra as engrenaxes para acoplalas ao Motor | Toca o Motor para deter/activar
      </div>
    </div>
  );
};

export default GearSequencer;