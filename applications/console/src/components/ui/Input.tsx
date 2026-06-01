import { forwardRef, type InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      className={[
        'w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-indigo/50 transition-colors duration-200 disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});
