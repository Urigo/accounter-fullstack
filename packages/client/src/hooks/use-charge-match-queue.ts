import { useCallback, useMemo, useState } from 'react';

export type ChargeMatchItemStatus = 'pending' | 'matched' | 'skipped';

export type UseChargeMatchQueue<TItem extends { id: string }> = {
  /** The queue of base charges under review, in queue order */
  items: TItem[];
  /** Index of the currently viewed base charge */
  activeIndex: number;
  /** The currently viewed base charge, or null once the queue is exhausted */
  activeItem: TItem | null;
  /** True when every item in the queue was matched or skipped */
  isDone: boolean;
  /** Session-only status per item id (no backend persistence) */
  statusById: Record<string, ChargeMatchItemStatus>;
  /**
   * Manually pin a base charge as the active item — used to jump to an upcoming
   * charge or revisit a skipped one. Passing an id not in the queue is a no-op.
   */
  selectItem: (id: string) => void;
  /** Flag an item as skipped and advance to the next one */
  skipItem: (id: string) => void;
  /**
   * Report the merge outcome for an item: on success it is flagged as matched
   * and the queue advances; on failure nothing changes so the user can retry
   */
  acceptItemStatus: (id: string, success: boolean) => void;
};

/**
 * Local (session-only) state management for the charge matching review queue:
 * tracks the active item and each item's pending/matched/skipped status.
 *
 * The active item is derived as the first still-pending item rather than a
 * stored index, so the user's position and session statuses survive query
 * refetches — including refetches where the item set changes (e.g. a merged
 * charge dropping out of the queue, or filters changing the page).
 */
export function useChargeMatchQueue<TItem extends { id: string }>(
  items: TItem[],
): UseChargeMatchQueue<TItem> {
  const [overrides, setOverrides] = useState<Record<string, ChargeMatchItemStatus>>({});
  // A manually pinned base charge takes precedence over the derived first-pending
  // item, letting the user jump to an upcoming charge or revisit a skipped one.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const statusById = useMemo(() => {
    const statuses: Record<string, ChargeMatchItemStatus> = {};
    for (const item of items) {
      statuses[item.id] = overrides[item.id] ?? 'pending';
    }
    return statuses;
  }, [items, overrides]);

  const firstPendingIndex = useMemo(
    () => items.findIndex(item => (overrides[item.id] ?? 'pending') === 'pending'),
    [items, overrides],
  );
  const derivedIndex = firstPendingIndex === -1 ? items.length : firstPendingIndex;

  // Honor a manual selection while it still points at an item in the queue;
  // otherwise fall back to the first-pending item
  const selectedIndex = selectedId === null ? -1 : items.findIndex(item => item.id === selectedId);
  const activeIndex = selectedIndex === -1 ? derivedIndex : selectedIndex;

  const selectItem = useCallback(
    (id: string) => {
      // Ignore ids not in the queue, and matched charges (already merged on the
      // backend, so there is nothing left to review)
      if (!items.some(item => item.id === id) || (overrides[id] ?? 'pending') === 'matched') {
        return;
      }
      setSelectedId(id);
    },
    [items, overrides],
  );

  const skipItem = useCallback((id: string) => {
    setOverrides(prev => ({ ...prev, [id]: 'skipped' }));
    // Drop any manual pin so the queue advances to the next pending charge
    setSelectedId(null);
  }, []);

  const acceptItemStatus = useCallback((id: string, success: boolean) => {
    if (!success) {
      // Merge failed: stay on the same charge so the user can retry or skip
      return;
    }
    setOverrides(prev => ({ ...prev, [id]: 'matched' }));
    // Drop any manual pin so the queue advances to the next pending charge
    setSelectedId(null);
  }, []);

  return {
    items,
    activeIndex,
    activeItem: items[activeIndex] ?? null,
    isDone: derivedIndex >= items.length,
    statusById,
    selectItem,
    skipItem,
    acceptItemStatus,
  };
}
