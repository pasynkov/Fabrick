import { type ElementType, type ComponentPropsWithoutRef } from 'react';

type ButtonProps<T extends ElementType = 'button'> = {
  as?: T;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'variant' | 'size' | 'className' | 'children'>;

const variantClasses: Record<string, string> = {
  primary: 'bg-gradient-to-r from-accent-indigo to-accent-cyan text-white hover:opacity-90 disabled:opacity-50',
  secondary: 'border border-border bg-surface-1/50 text-text-primary hover:bg-surface-2 disabled:opacity-50',
  danger: 'text-danger hover:bg-danger/10 disabled:opacity-50',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button<T extends ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps<T>) {
  const Tag = (as ?? 'button') as ElementType;
  return (
    <Tag
      {...props}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 cursor-pointer disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}
