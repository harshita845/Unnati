import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'leaf' | 'orange';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center rounded-full border font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
      default: 'bg-[var(--brand-green,#236B34)] text-white border-[var(--brand-green,#236B34)]',
      destructive: 'bg-[var(--brand-error,#D6402F)]/10 text-[var(--brand-error,#D6402F)] border-[var(--brand-error,#D6402F)]/30',
      outline: 'text-[var(--brand-ink,#1C2B20)] border-[var(--brand-border,#E9E2D3)] bg-white/90 backdrop-blur-sm',
      secondary: 'bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-ink,#1C2B20)] border-[var(--brand-border,#E9E2D3)]',
      leaf: 'bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border-[var(--brand-leaf,#5FA82E)]/30',
      orange: 'bg-gradient-to-r from-[var(--brand-amber,#FFB020)] to-[var(--brand-orange,#F97316)] text-white border-transparent shadow-xs',
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;


