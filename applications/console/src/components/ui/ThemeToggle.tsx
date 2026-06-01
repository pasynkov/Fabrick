import { type ReactElement } from 'react';
import { useTheme } from './ThemeProvider';

// Cycle: dark → light → auto → dark
const NEXT: Record<string, 'dark' | 'light' | 'auto'> = {
  dark: 'light',
  light: 'auto',
  auto: 'dark',
};

const LABEL: Record<string, string> = {
  dark: 'Switch to light mode',
  light: 'Switch to auto (OS) mode',
  auto: 'Switch to dark mode',
};

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const icons: Record<string, ReactElement> = {
    light: <SunIcon />,
    dark: <MoonIcon />,
    auto: <AutoIcon />,
  };

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={LABEL[theme]}
      title={LABEL[theme]}
      className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-indigo/50"
    >
      {icons[theme]}
    </button>
  );
}
