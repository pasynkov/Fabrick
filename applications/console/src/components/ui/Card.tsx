import { type ElementType, type ComponentPropsWithoutRef } from 'react';

type CardProps<T extends ElementType = 'div'> = {
  as?: T;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'interactive' | 'className' | 'children'>;

export function Card<T extends ElementType = 'div'>({
  as,
  interactive = false,
  className = '',
  children,
  ...props
}: CardProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag
      {...props}
      className={[
        'bg-surface-1 border border-border rounded-lg',
        interactive ? 'hover:border-white/10 transition-colors duration-200 cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}
