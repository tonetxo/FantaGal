
import React, { useRef, useEffect, useState } from 'react';

interface BubbleXYPadProps {
  xValue: number;
  yValue: number;
  xLabel: string;
  yLabel: string;
  onChange: (x: number, y: number) => void;
}

const BubbleXYPad: React.FC<BubbleXYPadProps> = ({ xValue, yValue, xLabel, yLabel, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calcula la posición y notifica el cambio
  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = 1 - ((clientY - rect.top) / rect.height); // Invertimos Y para que arriba sea 1

    // Clamp values between 0 and 1
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));

    onChange(clampedX, clampedY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX, e.clientY);
    }
  };

  const onInteractionEnd = () => {
    setIsDragging(false);
  };

  // Global mouse up to catch dragging outside
  useEffect(() => {
    window.addEventListener('mouseup', onInteractionEnd);
    window.addEventListener('touchend', onInteractionEnd);
    return () => {
      window.removeEventListener('mouseup', onInteractionEnd);
      window.removeEventListener('touchend', onInteractionEnd);
    };
  }, []);

  // Visual position (percentage)
  const left = `${xValue * 100}%`;
  const top = `${(1 - yValue) * 100}%`;

  return (
    <div className="flex flex-col items-center w-full max-w-[320px] mx-auto select-none touch-none">
      <div className="flex justify-between w-full text-[10px] text-orange-500 mb-1 tracking-widest uppercase font-mono">
        <span>Y: {yLabel}</span>
        <span>X: {xLabel}</span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-square bg-stone-900/30 border border-stone-800/50 rounded-xl overflow-hidden backdrop-blur-sm shadow-inner group cursor-crosshair touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '20% 20%' }}>
        </div>

        {/* Axis Labels inside */}
        <div className="absolute bottom-2 right-2 text-[9px] text-orange-500/20 pointer-events-none font-bold">1.0</div>
        <div className="absolute bottom-2 left-2 text-[9px] text-orange-500/20 pointer-events-none font-bold">0.0</div>

        {/* The Latent Bubble */}
        <div
          className="absolute w-20 h-20 -ml-10 -mt-10 rounded-full pointer-events-none transition-transform duration-75 ease-out"
          style={{ left, top }}
        >
          {/* Core Core */}
          <div className={`absolute inset-0 bg-orange-500/20 rounded-full blur-xl ${isDragging ? 'scale-125' : 'scale-100 animate-pulse'} transition-all duration-300`} />
          {/* Inner Glow */}
          <div className="absolute inset-4 bg-orange-400/40 rounded-full blur-md" />
          {/* Center Point */}
          <div className="absolute inset-[38%] bg-orange-100/80 rounded-full blur-[1px] shadow-[0_0_15px_rgba(249,115,22,0.8)]" />

          {/* Ripple effect when dragging */}
          {isDragging && (
            <div className="absolute inset-[-50%] border border-orange-500/20 rounded-full animate-ping opacity-20" />
          )}
        </div>

        {/* Crosshair lines */}
        <div className="absolute top-0 bottom-0 w-[1px] bg-orange-500/10 pointer-events-none" style={{ left }} />
        <div className="absolute left-0 right-0 h-[1px] bg-orange-500/10 pointer-events-none" style={{ top }} />
      </div>
    </div>
  );
};

export default BubbleXYPad;
