import React from 'react';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'link' | 'amber';

type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'default',
  className = '',
  onClick,
  type = 'button',
  disabled = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none';
  
  const variantStyles = {
    default: 'bg-emerald-600 text-white hover:bg-emerald-700',
    outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
    ghost: 'text-slate-300 hover:bg-slate-800',
    link: 'text-emerald-500 hover:underline',
    amber: 'bg-amber-500 text-white hover:bg-amber-400',
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// 卡片組件
type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

// 輸入框組件
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-slate-800 border ${
          error ? 'border-red-500' : 'border-slate-700'
        } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};
