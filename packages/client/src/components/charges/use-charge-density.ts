import { useCallback, useEffect, useState } from 'react';

export type ChargeDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'accounter.charges.density';

function read(): ChargeDensity {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    // Private-mode / disabled storage: fall back to the default rather than breaking the list.
    return 'comfortable';
  }
}

/**
 * Row density for the charges list, remembered per browser.
 *
 * Persisted because it is a workspace preference, not a per-screen one: an accountant who wants a
 * dense list wants it on every charges screen, and re-picking it after each navigation would make the
 * control useless. Shared across every mounted list via a storage event so two `ChargesTable`s on one
 * page (the VAT report renders three) stay in step.
 */
export function useChargeDensity(): [ChargeDensity, (next: ChargeDensity) => void] {
  const [density, setDensity] = useState<ChargeDensity>(read);

  useEffect(() => {
    // `storage` only fires for *other* tabs, so same-page lists get a custom event instead.
    const sync = (): void => setDensity(read());
    window.addEventListener('storage', sync);
    window.addEventListener(STORAGE_KEY, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(STORAGE_KEY, sync);
    };
  }, []);

  const update = useCallback((next: ChargeDensity) => {
    setDensity(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference is lost on reload, but the current session still honours it.
    }
    window.dispatchEvent(new Event(STORAGE_KEY));
  }, []);

  return [density, update];
}
