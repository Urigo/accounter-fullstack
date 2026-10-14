import { useCallback, useSyncExternalStore } from 'react';
import { LEDGER_FORM_STRINGS, type LedgerFormLang, type LedgerFormStrings } from './strings.js';

const STORAGE_KEY = 'accounter-ledger-record-form-lang';

const LANG_DIRECTION: Record<LedgerFormLang, 'ltr' | 'rtl'> = { en: 'ltr', he: 'rtl' };

const listeners = new Set<() => void>();
/** The choice, when the browser can't store it (private mode, blocked site data) */
let unstoredLang: LedgerFormLang | null = null;

function getLang(): LedgerFormLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'he') {
      return stored;
    }
  } catch {
    // Unavailable storage: fall back to the unstored choice, then the default
  }
  return unstoredLang ?? 'en';
}

function setLang(lang: LedgerFormLang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    unstoredLang = lang;
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type UseLedgerFormLang = {
  lang: LedgerFormLang;
  /** Text direction of the language: lay the dialog out right-to-left for Hebrew */
  dir: 'ltr' | 'rtl';
  strings: LedgerFormStrings;
  toggleLang: () => void;
};

/**
 * The language of the ledger record dialogs (insert and edit) and their form: English or Hebrew.
 * The rest of the app is English-only, so this is deliberately local to them rather than global
 * i18n machinery. English is the default; a choice is remembered in the browser and shared by every
 * ledger record dialog at once.
 */
export function useLedgerFormLang(): UseLedgerFormLang {
  const lang = useSyncExternalStore(subscribe, getLang, () => 'en' as const);
  const toggleLang = useCallback(() => setLang(getLang() === 'en' ? 'he' : 'en'), []);
  return { lang, dir: LANG_DIRECTION[lang], strings: LEDGER_FORM_STRINGS[lang], toggleLang };
}
