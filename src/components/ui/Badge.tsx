import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  // In monochrome, we distinguish by fill vs outline
  const variants = {
    default: 'bg-black text-white border border-black',
    success: 'bg-black text-white border border-black', // Solid for positive
    warning: 'bg-white text-black border border-black border-dashed', // Dashed for warning
    danger: 'bg-white text-black border border-black font-bold', // Bold for danger
    info: 'bg-white text-black border border-black',
    neutral: 'bg-white text-black border border-black',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
