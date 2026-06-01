import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'auto';
type ResolvedTheme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

export const ThemeContext = createContext<ThemeCtx | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function computeResolved(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === 'auto' ? systemTheme : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('fabrick-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return 'auto';
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme = computeResolved(theme, systemTheme);

  // Apply resolved theme to <html data-theme>
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  // Subscribe to OS preference changes while in auto mode
  useEffect(() => {
    if (theme !== 'auto') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    if (t === 'auto') {
      localStorage.removeItem('fabrick-theme');
    } else {
      localStorage.setItem('fabrick-theme', t);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
