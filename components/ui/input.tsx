import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <input
          ref={ref}
          className={cn(
            'w-full h-9 px-3 rounded-md bg-[#09090b] text-zinc-100 text-sm font-sans font-medium',
            'border border-zinc-800 placeholder:text-zinc-500',
            'transition-colors duration-150 ease-out',
            'focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]',
            'disabled:opacity-50 disabled:bg-zinc-950',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400 mt-1">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
