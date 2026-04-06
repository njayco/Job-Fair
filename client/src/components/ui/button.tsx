import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyle = "inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-bg)] disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)]",
      accent: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] focus:ring-[var(--color-accent)]",
      secondary: "bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] focus:ring-[var(--color-border)]",
      outline: "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white focus:ring-[var(--color-primary)]",
      ghost: "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] focus:ring-[var(--color-surface)]",
      danger: "bg-[var(--color-red-indicator)] text-white hover:bg-red-600 focus:ring-red-600",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2 text-sm",
      lg: "h-12 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyle, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
