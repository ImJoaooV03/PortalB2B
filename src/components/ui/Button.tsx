import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export default function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    // Solid Black, White Text -> Hover: White, Black Text, Black Border
    primary: 'bg-black text-white border border-black hover:bg-white hover:text-black shadow-none',
    // White, Black Text, Black Border -> Hover: Black, White Text
    secondary: 'bg-white text-black border border-black hover:bg-black hover:text-white shadow-none',
    // Same as secondary for mono theme
    outline: 'bg-transparent border border-black text-black hover:bg-black hover:text-white',
    // No border -> Hover: Black bg
    ghost: 'bg-transparent text-black hover:bg-black hover:text-white border border-transparent',
    // Danger is just high contrast in mono
    danger: 'bg-white text-black border border-black hover:bg-black hover:text-white',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10 p-2 flex items-center justify-center',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-none font-medium transition-all duration-200', // rounded-none for sharper look
        'focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        'active:translate-y-0.5', // Mechanical click feel
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
    </button>
  );
}
