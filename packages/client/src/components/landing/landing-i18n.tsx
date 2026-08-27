import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CONTENT, type LandingContent, type LandingLang } from './landing-content.js';

/**
 * Language state for the public landing page only — the app behind the login is
 * English-only, so this deliberately does not touch any global i18n machinery.
 * Hebrew is the default: the page targets Israeli businesses.
 */

const STORAGE_KEY = 'accounter-landing-lang';

type LandingLangContextValue = {
  lang: LandingLang;
  setLang: (lang: LandingLang) => void;
  content: LandingContent;
};

const LandingLangContext = createContext<LandingLangContextValue | null>(null);

function readStoredLang(): LandingLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'he') {
      return stored;
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — fall through.
  }
  return 'he';
}

export function LandingLangProvider({ children }: { children: ReactNode }): ReactElement {
  const [lang, setLang] = useState<LandingLang>(readStoredLang);

  const persistLang = useCallback((next: LandingLang) => {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is fine; the choice still applies for this visit.
    }
  }, []);

  const value = useMemo(
    () => ({ lang, setLang: persistLang, content: CONTENT[lang] }),
    [lang, persistLang],
  );

  return <LandingLangContext.Provider value={value}>{children}</LandingLangContext.Provider>;
}

export function useLandingContent(): LandingLangContextValue {
  const value = useContext(LandingLangContext);
  if (!value) {
    throw new Error('useLandingContent must be used within LandingLangProvider');
  }
  return value;
}
