import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'accent';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-leaf,#5FA82E)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

    const variants = {
      default: 'bg-[var(--brand-green,#236B34)] text-white hover:bg-[var(--brand-green-dark,#1B5128)] active:scale-[0.98] shadow-sm',
      secondary: 'bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border border-[var(--brand-leaf,#5FA82E)]/30 hover:bg-[var(--brand-leaf-tint,#EAF5E0)]/80',
      accent: 'bg-gradient-to-r from-[var(--brand-amber,#FFB020)] via-[var(--brand-orange,#F97316)] to-[var(--brand-orange-deep,#E8590C)] text-white shadow-md hover:brightness-105 active:scale-[0.98]',
      outline: 'border-2 border-[var(--brand-green,#236B34)] text-[var(--brand-green,#236B34)] bg-transparent hover:bg-[var(--brand-leaf-tint,#EAF5E0)]',
      ghost: 'hover:bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-ink,#1C2B20)]',
      destructive: 'bg-[var(--brand-error,#D6402F)] text-white hover:opacity-90',
    };

    const sizes = {
      sm: 'h-7 px-3 text-xs',
      default: 'h-10 px-4 py-2 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;


