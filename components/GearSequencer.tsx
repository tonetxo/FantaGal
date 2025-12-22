import React, { useRef, useEffect, useState } from 'react';
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

const GearSequencer = ({ onTrigger }: { onTrigger: (pitch: number) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gears, setGears] = useState<Gear[]>([
    { id: 0, x: 150, y: 300, radius: 60, teeth: 12, angle: 0, speed: 0.02, isDragging: false, isConnected: true, color: '#ff9f1c' }, // Motor
    { id: 1, x: 300, y: 200, radius: 40, teeth: 8, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#b08d55' },
    { id: 2, x: 100, y: 150, radius: 30, teeth: 6, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#e07a5f' },
    { id: 3, x: 250, y: 400, radius: 50, teeth: 10, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#cb997e' },
    { id: 4, x: 200, y: 100, radius: 25, teeth: 5, angle: 0, speed: 0, isDragging: false, isConnected: false, color: '#ddb892' },
  ]);

  const requestRef = useRef<number>(0);
  const dragInfo = useRef<{ id: number, offsetX: number, offsetY: number } | null>(null);

  // Audio Context unlock check
  const hasStartedAudio = useRef(false);

  const update = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nextGears = [...gears];
    // Motor sempre activo
    nextGears[0].isConnected = true;
    nextGears[0].speed = 0.02; 

    // Resetear non-motores antes de calcular
    for (let i = 1; i < nextGears.length; i++) {
        // Se a estamos arrastrando, desconectámola temporalmente para evitar saltos
        if (nextGears[i].isDragging) {
            nextGears[i].isConnected = false;
            nextGears[i].speed = 0;
        } else {
            // Asumimos desconectada e buscamos parentes
            // (Nota: isto é simple, para cadeas complexas necesitaríamos un grafo de dependencias real)
            // Para simplificar e facer "engranaxe pegajosa", gardamos o estado anterior se é válido
            // Pero o máis robusto é recalcular cada frame desde a fonte (motor)
            nextGears[i].isConnected = false;
            nextGears[i].speed = 0;
        }
    }

    // Propagar enerxía (Simple flood fill iterativo)
    let changed = true;
    let iterations = 0;
    while(changed && iterations < 10) {
        changed = false;
        iterations++;
        
        for (let i = 0; i < nextGears.length; i++) {
            if (!nextGears[i].isConnected) continue; // Só propagamos desde as conectadas

            for (let j = 0; j < nextGears.length; j++) {
                if (i === j) continue;
                if (nextGears[j].isDragging) continue;
                if (nextGears[j].isConnected) continue; // Xa está conectada

                const dx = nextGears[i].x - nextGears[j].x;
                const dy = nextGears[i].y - nextGears[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const combinedRadius = nextGears[i].radius + nextGears[j].radius;
                
                // Histerese: Conecta se está preto, mantén se está un pouco máis lonxe
                // Como recalculamos todo cada frame, o limiar debe ser consistente.
                // Engadimos un "snap" virtual visual se quixéramos, pero aquí usamos marxe física.
                const margin = 12; // Marxe de engranaxe xenerosa
                
                if (dist < combinedRadius + margin) {
                    nextGears[j].isConnected = true;
                    // Inverter xiro
                    nextGears[j].speed = -nextGears[i].speed * (nextGears[i].radius / nextGears[j].radius);
                    
                    // Visual link
                    ctx.beginPath();
                    ctx.moveTo(nextGears[i].x, nextGears[i].y);
                    ctx.lineTo(nextGears[j].x, nextGears[j].y);
                    ctx.strokeStyle = "rgba(255, 191, 105, 0.3)";
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    
                    changed = true;
                }
            }
        }
    }

    // Debuxar e actualizar rotación
    nextGears.forEach(g => {
        if (g.isConnected) {
            const prevAngle = g.angle;
            g.angle += g.speed;
            
            // Trigger sonoro
            const normPrev = Math.abs(prevAngle % (Math.PI * 2));
            const normCurr = Math.abs(g.angle % (Math.PI * 2));
            
            // Trigger ás 12 en punto (cando cruza 0 ou 2PI)
            if (normCurr < normPrev && Math.abs(normCurr - normPrev) > 0.1) {
                 if (hasStartedAudio.current) {
                    onTrigger(g.radius);
                 }
            }
        }

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        
        // Sombra se arrastramos
        if (g.isDragging) {
            ctx.shadowColor = "#ffbf69";
            ctx.shadowBlur = 20;
        }

        ctx.fillStyle = g.isConnected ? g.color : '#2a2420'; 
        ctx.strokeStyle = g.isConnected ? '#3a2e26' : '#b08d55';
        ctx.lineWidth = 2;

        // Corpo
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
        
        // Perno
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#b08d55';
        ctx.fill();

        // Marcador trigger
        if (g.isConnected) {
            ctx.beginPath();
            ctx.arc(0, -innerRadius + 5, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffbf69';
            ctx.fill();
        }

        ctx.restore();
    });
    
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    if (!hasStartedAudio.current) {
        // Primeiro toque desbloquea audio
        synthManager.resume();
        hasStartedAudio.current = true;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = gears.length - 1; i >= 0; i--) {
        const g = gears[i];
        const dx = x - g.x;
        const dy = y - g.y;
        if (Math.sqrt(dx*dx + dy*dy) < g.radius) {
            if (g.id === 0) return; 
            dragInfo.current = { id: g.id, offsetX: dx, offsetY: dy };
            
            // Update visual state immediately
            const newGears = [...gears];
            newGears[i].isDragging = true;
            setGears(newGears);
            break;
        }
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!dragInfo.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const gearIndex = gears.findIndex(g => g.id === dragInfo.current?.id);
    if (gearIndex !== -1) {
        gears[gearIndex].x = x - dragInfo.current.offsetX;
        gears[gearIndex].y = y - dragInfo.current.offsetY;
        gears[gearIndex].isDragging = true;
    }
  };

  const handleEnd = () => {
    if (dragInfo.current) {
        const gearIndex = gears.findIndex(g => g.id === dragInfo.current?.id);
        if (gearIndex !== -1) {
            gears[gearIndex].isDragging = false;
        }
        dragInfo.current = null;
        setGears([...gears]); 
    }
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
        Arrastra as engrenaxes para acoplalas ao Motor
      </div>
    </div>
  );
};

export default GearSequencer;