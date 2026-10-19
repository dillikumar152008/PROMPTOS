import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'cobalt';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border select-none',
        (variant === 'default' || variant === 'secondary') && 'bg-zinc-900 text-zinc-300 border-zinc-800',
        variant === 'success' && 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
        variant === 'warning' && 'bg-amber-950/60 text-amber-400 border-amber-800/50',
        variant === 'error' && 'bg-red-950/60 text-red-400 border-red-800/50',
        variant === 'cobalt' && 'bg-blue-950/60 text-blue-400 border-blue-800/50',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
