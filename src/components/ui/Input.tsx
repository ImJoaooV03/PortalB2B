import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-bold text-black block uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'flex h-10 w-full rounded-none border border-black bg-white px-3 py-2 text-sm text-black',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-1 focus:ring-black focus:border-black',
              'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500',
              'transition-all duration-200',
              icon && 'pl-10',
              error && 'border-black ring-1 ring-black', // Error just enforces black border visibility
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-black font-medium mt-1">⚠ {error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
