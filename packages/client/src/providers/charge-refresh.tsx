import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

// A charge-id → refresh registry for the charges table.
//
// Every `ChargeRow` already owns a network-only refetch of its own charge, threaded onto
// `row.original.onChange` for the actions rendered inside that row. That covers the charge a user
// acted on, but not the *other* charges a batch mutation touched — most visibly "Approve selected"
// in the similar-charges dialog, which applies one charge's tags/description to N others that may
// themselves be rows in the table behind the dialog.
//
// Those rows are unreachable from the mutation site: it has charge ids, not rows. The registry
// closes that gap — each row publishes its refetch under its id, and anything holding a list of
// mutated ids can refresh whichever of them happen to be on screen. Ids that aren't rendered are
// silently skipped, so callers never need to know what the table is currently showing.

interface ChargeRefreshContextValue {
  /** Publishes a charge's refresh handler. Returns the matching unregister. */
  register: (chargeId: string, refresh: () => void) => () => void;
  /** Refreshes every one of these charges that is currently rendered; unknown ids are ignored. */
  refreshCharges: (chargeIds: string[]) => void;
}

const ChargeRefreshContext = createContext<ChargeRefreshContextValue>({
  register: () => () => void 0,
  refreshCharges: () => void 0,
});

export function ChargeRefreshProvider({ children }: { children: ReactNode }): ReactElement {
  // A ref, not state: registrations are a side channel between rows and mutation sites, and
  // re-rendering the whole table whenever a row mounts would be pure cost. A `Set` per id keeps
  // concurrent registrations for the same charge (a charge rendered twice, or React StrictMode's
  // double-invoked effects) from clobbering one another.
  const registry = useRef(new Map<string, Set<() => void>>());

  const register = useCallback((chargeId: string, refresh: () => void) => {
    const handlers = registry.current.get(chargeId) ?? new Set<() => void>();
    handlers.add(refresh);
    registry.current.set(chargeId, handlers);

    return () => {
      const current = registry.current.get(chargeId);
      if (!current) {
        return;
      }
      current.delete(refresh);
      if (current.size === 0) {
        registry.current.delete(chargeId);
      }
    };
  }, []);

  const refreshCharges = useCallback((chargeIds: string[]) => {
    for (const chargeId of chargeIds) {
      // Snapshot before iterating: a refresh handler can drop or replace registrations (a refetch
      // that removes the row) while we're still walking the set.
      const handlers = [...(registry.current.get(chargeId) ?? [])];
      for (const refresh of handlers) {
        refresh();
      }
    }
  }, []);

  // Both handlers close over the ref alone, so this value is stable for the provider's lifetime.
  const value = useMemo<ChargeRefreshContextValue>(
    () => ({ register, refreshCharges }),
    [register, refreshCharges],
  );

  return <ChargeRefreshContext.Provider value={value}>{children}</ChargeRefreshContext.Provider>;
}

/**
 * Publishes `refresh` as the way to reload `chargeId` for as long as the caller is mounted.
 *
 * `refresh` is a dependency on purpose: a row's refetch identity tracks urql's `executeQuery`, so
 * re-registering when it changes is what keeps the registry from holding a stale handler.
 */
export function useRegisterChargeRefresh(chargeId: string, refresh: () => void): void {
  const { register } = useContext(ChargeRefreshContext);

  useEffect(() => register(chargeId, refresh), [register, chargeId, refresh]);
}

/**
 * Returns a stable handler that reloads the given charges wherever they're rendered.
 *
 * Safe outside a `ChargeRefreshProvider` — the default context value makes it a no-op, so mutation
 * hooks can call it unconditionally without caring whether a charges table is on screen.
 */
export function useRefreshCharges(): (chargeIds: string[]) => void {
  return useContext(ChargeRefreshContext).refreshCharges;
}
