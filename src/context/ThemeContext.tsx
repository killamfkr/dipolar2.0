import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

export type Theme = 'dark' | 'light' | 'system';

function getThemeKey(userId: string | null): string {
  return userId ? `streamio-theme-${userId}` : 'streamio-theme';
}

function loadThemeForUser(userId: string | null): Theme {
  try {
    const key = getThemeKey(userId);
    const s = localStorage.getItem(key);
    if (s === 'dark' || s === 'light' || s === 'system') return s;
  } catch {
    /* ignore */
  }
  return 'dark';
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getResolved(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  const [theme, setThemeState] = useState<Theme>(() => loadThemeForUser(userId));
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => getResolved(theme));

  useEffect(() => {
    setThemeState(loadThemeForUser(userId));
  }, [userId]);

  useEffect(() => {
    const resolvedTheme = getResolved(theme);
    setResolved(resolvedTheme);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const m = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => setResolved(m.matches ? 'light' : 'dark');
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        localStorage.setItem(getThemeKey(userId), next);
      } catch {
        /* ignore */
      }
    },
    [userId]
  );

  const value: ThemeContextValue = { theme, setTheme, resolved };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
