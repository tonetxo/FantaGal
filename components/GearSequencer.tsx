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
  color: string;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    type: 'smoke' | 'oil';
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
    { id: 0, x: 150, y: 300, radius: 60, teeth: 12, angle: 0, speed: 0.02, isDragging: false, isConnected: true, color: '#ff9f1c' }, // Motor
    { id: 1, x: 300, y: 200, radius: 40, teeth: 8, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#b08d55' },
    { id: 2, x: 100, y: 150, radius: 30, teeth: 6, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#e07a5f' },
    { id: 3, x: 250, y: 400, radius: 50, teeth: 10, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#cb997e' },
    { id: 4, x: 200, y: 100, radius: 25, teeth: 5, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#ddb892' },
  ]);

  const particlesRef = useRef<Particle[]>([]);

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
          color: '#ff9f1c' 
      });

      const count = Math.max(3, Math.min(8, gearConfig.numGears));
      const colors = ['#b08d55', '#e07a5f', '#cb997e', '#ddb892', '#8d99ae', '#ef233c'];

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
              color: colors[i % colors.length]
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

  const update = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gears = gearsRef.current; // Access ref directly

    // Update Motor State
    gears[0].isConnected = isMotorActive.current;
    gears[0].speed = isMotorActive.current ? 0.02 * speedMultRef.current : 0;

    // Reset non-motors (unless dragging)
    for (let i = 1; i < gears.length; i++) {
        if (gears[i].isDragging) {
            gears[i].isConnected = false;
            gears[i].speed = 0;
        } else {
            gears[i].isConnected = false;
            gears[i].speed = 0;
        }
    }

    // Propagate Energy (Iterative Flood Fill)
    let changed = true;
    let iterations = 0;
    while(changed && iterations < 10) {
        changed = false;
        iterations++;

        for (let i = 0; i < gears.length; i++) {
            if (!gears[i].isConnected) continue;

            // Chance to spawn oil based on speed and turbulence
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

                    // Visual link
                    ctx.beginPath();
                    ctx.moveTo(gears[i].x, gears[i].y);
                    ctx.lineTo(gears[j].x, gears[j].y);
                    ctx.strokeStyle = "rgba(255, 191, 105, 0.3)";
                    ctx.lineWidth = 4;
                    ctx.stroke();

                    changed = true;
                }
            }
        }
    }

    // Draw and Update Rotation
    gears.forEach(g => {
        if (g.isConnected) {
            const prevAngle = g.angle;
            g.angle += g.speed;

            const normPrev = Math.abs(prevAngle % (Math.PI * 2));
            const normCurr = Math.abs(g.angle % (Math.PI * 2));

            // Check for full rotation (trigger)
            if (normCurr < normPrev && Math.abs(normCurr - normPrev) > 0.1) {
                 if (hasStartedAudio.current) {
                    onTrigger(g.radius);
                    // Spawn Smoke on Trigger
                    const smokeAmount = 5 + Math.floor(diffusionRef.current * 10);
                    spawnSmoke(g.x, g.y - g.radius, smokeAmount);
                 }
            }
        }

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);

        // Shadow if dragging
        if (g.isDragging) {
            ctx.shadowColor = "#ffbf69";
            ctx.shadowBlur = 20;
        }

        ctx.fillStyle = g.isConnected ? g.color : '#2a2420';
        ctx.strokeStyle = g.isConnected ? '#3a2e26' : '#b08d55';
        ctx.lineWidth = 2;

        // Gear Body
        ctx.beginPath();
        const outerRadius = g.radius;
        const innerRadius = g.radius - 8;

        for (let i = 0; i < g.teeth * 2; i++) {
            const a = (Math.PI * 2 * i) / (g.teeth * 2);
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eixe
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#151210';
        ctx.fill();

        // Bolt
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#b08d55';
        ctx.fill();

        // Trigger Marker
        if (g.isConnected) {
            ctx.beginPath();
            ctx.arc(0, -innerRadius + 5, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffbf69';
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
            p.vx *= 0.95; // Drag
        } else {
            p.vy += 0.1; // Gravity
        }

        if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        if (p.type === 'smoke') {
             ctx.fillStyle = p.color.replace(')', `, ${p.life * 0.5})`); // Hack for fading alpha
        } else {
             ctx.fillStyle = `rgba(0, 0, 0, ${p.life})`;
        }
        
        ctx.fill();
    }

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Only runs once, but now accesses refs!

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
    <div className="w-full h-full flex items-center justify-center bg-[#151210]">
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
      <div className="absolute bottom-4 text-[#b08d55] text-[9px] font-mono pointer-events-none opacity-50 uppercase tracking-widest w-full text-center">
        Arrastra as engrenaxes para acoplalas ao Motor | Toca o Motor para deter/activar
      </div>
    </div>
  );
};

export default GearSequencer;