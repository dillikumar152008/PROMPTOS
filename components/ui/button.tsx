import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'secondary' | 'ghost' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'solid', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors duration-150 ease-out cursor-pointer select-none rounded-md',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]',
          'disabled:opacity-50 disabled:pointer-events-none',
          // Sizes
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-9 px-4 text-sm font-medium',
          size === 'lg' && 'h-10 px-5 text-sm font-medium',
          // Variants (Solid, flat, no gradients, no soft shadows)
          variant === 'solid' && 'bg-white hover:bg-zinc-200 text-zinc-950 font-semibold',
          variant === 'secondary' && 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700',
          variant === 'ghost' && 'bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white',
          variant === 'accent' && 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium',
          variant === 'danger' && 'bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
