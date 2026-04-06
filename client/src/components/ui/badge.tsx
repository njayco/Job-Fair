import React from 'react';
import { cn } from './button';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'accent';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyle = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider transition-colors";
  
  const variants = {
    default: "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)]",
    success: "bg-[var(--color-green-indicator)]/10 text-[var(--color-green-indicator)] border border-[var(--color-green-indicator)]/20",
    warning: "bg-[var(--color-yellow-indicator)]/10 text-[var(--color-yellow-indicator)] border border-[var(--color-yellow-indicator)]/20",
    danger: "bg-[var(--color-red-indicator)]/10 text-[var(--color-red-indicator)] border border-[var(--color-red-indicator)]/20",
    accent: "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20",
    outline: "text-[var(--color-text)] border border-[var(--color-border)]",
  };

  return (
    <div className={cn(baseStyle, variants[variant], className)} {...props} />
  );
}
