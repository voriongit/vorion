'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'neon';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:pointer-events-none',
          {
            // Variants
            'bg-cyan-600 hover:bg-cyan-500 text-white': variant === 'default',
            'bg-transparent hover:bg-white/5 text-gray-300': variant === 'ghost',
            'border border-gray-600 bg-transparent hover:border-cyan-500 hover:text-cyan-400':
              variant === 'outline',
            'bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20':
              variant === 'neon',
            // Sizes
            'text-xs px-3 py-1 rounded': size === 'sm',
            'text-sm px-4 py-2 rounded-md': size === 'md',
            'text-base px-6 py-3 rounded-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
