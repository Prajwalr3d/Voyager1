import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...rest
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantStyles = {
    primary:
      'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white shadow-sm border border-violet-500/30',
    secondary:
      'bg-[#18181B] hover:bg-[#27272A] active:bg-[#131316] text-[#F4F4F5] border border-[#29292F]',
    ghost:
      'bg-transparent hover:bg-[#18181B] active:bg-[#27272A] text-[#A1A1AA] hover:text-[#F4F4F5]',
    danger:
      'bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-950 text-rose-300 border border-rose-800/60',
    outline:
      'bg-transparent hover:bg-[#131316] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#29292F]',
  };

  const sizeStyles = {
    xs: 'text-xs px-2 py-1 gap-1.5',
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : icon}
      {children}
    </button>
  );
};

