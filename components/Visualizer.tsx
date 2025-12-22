
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  turbulence: number;
  viscosity: number;
  pressure: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ turbulence, viscosity, pressure }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const particles: Array<{ x: number, y: number, r: number, vx: number, vy: number }> = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 4 + 1,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }

    const render = () => {
      time += 0.01 * (1 + turbulence * 5);
      
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Draw background gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
      );
      
      // Orange/Gold Titan hues
      const hue = 30 + (pressure * 20);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 40%, 0.4)`);
      gradient.addColorStop(1, `hsla(${hue - 10}, 100%, 5%, 0.8)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Organic "Pipes" (simulated via vertical columns)
      const columnCount = 12;
      const colWidth = canvas.width / columnCount;
      for (let i = 0; i < columnCount; i++) {
        const h = Math.sin(time + i * 0.5) * 50 * turbulence + (canvas.height * 0.5);
        const opacity = 0.1 + (pressure * 0.3);
        ctx.fillStyle = `rgba(255, 140, 0, ${opacity})`;
        ctx.fillRect(i * colWidth + 10, canvas.height - h, colWidth - 20, h);
      }

      // "Methane" fog
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 3; i++) {
        const shiftX = Math.sin(time * 0.5 + i) * 100;
        const shiftY = Math.cos(time * 0.3 + i) * 50;
        ctx.fillStyle = `rgba(200, 100, 0, ${0.1 * viscosity})`;
        ctx.beginPath();
        ctx.arc(canvas.width / 2 + shiftX, canvas.height / 2 + shiftY, 300 + i * 100, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Particles
      particles.forEach(p => {
        p.x += p.vx * turbulence * 3;
        p.y += p.vy * (1 - viscosity) * 3;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = `rgba(255, 200, 100, ${0.4 + pressure * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [turbulence, viscosity, pressure]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default Visualizer;
