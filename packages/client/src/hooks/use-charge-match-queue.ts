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
  const activeIndex = firstPendingIndex === -1 ? items.length : firstPendingIndex;

  const skipItem = useCallback((id: string) => {
    setOverrides(prev => ({ ...prev, [id]: 'skipped' }));
  }, []);

  const acceptItemStatus = useCallback((id: string, success: boolean) => {
    if (!success) {
      // Merge failed: stay on the same charge so the user can retry or skip
      return;
    }
    setOverrides(prev => ({ ...prev, [id]: 'matched' }));
  }, []);

  return {
    items,
    activeIndex,
    activeItem: items[activeIndex] ?? null,
    isDone: activeIndex >= items.length,
    statusById,
    skipItem,
    acceptItemStatus,
  };
}
