
import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string }> = ({ children, className = '', ...props }) => (
  <div className={`bg-slate-800 rounded-xl border border-slate-700 shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'amber' }> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-amber-500 hover:bg-amber-400 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    success: "bg-amber-600 hover:bg-amber-500 text-white",
    amber: "bg-amber-500 hover:bg-amber-400 text-white"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input 
    className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-slate-500 ${className}`}
    {...props}
  />
);

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-slate-700' }) => (
  <span className={`${color} text-xs font-semibold px-2 py-0.5 rounded text-white`}>
    {children}
  </span>
);

export const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}> = ({ value, min, max, onChange, className = '' }) => (
  <input
    type="range"
    min={min}
    max={max}
    value={value}
    onChange={(e) => onChange(parseInt(e.target.value))}
    className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 ${className}`}
  />
);
