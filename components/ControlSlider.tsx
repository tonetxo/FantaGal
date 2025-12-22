
import React from 'react';

interface ControlSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
}

const ControlSlider: React.FC<ControlSliderProps> = ({ label, value, min = 0, max = 1, step = 0.01, onChange, unit = "" }) => {
  return (
    <div className="flex flex-col space-y-3 mb-8 group">
      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-orange-200/50 group-hover:text-orange-400 transition-colors">
        <span>{label}</span>
        <span className="mono bg-stone-950/50 px-2 py-0.5 rounded border border-white/5">{value.toFixed(2)}{unit}</span>
      </div>
      <div className="relative h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-stone-800 rounded-full appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 transition-all"
        />
      </div>
    </div>
  );
};

export default ControlSlider;
