import { useCallback, useMemo, useState } from 'react';

export type ChargeMatchItemStatus = 'pending' | 'matched' | 'skipped';

export type UseChargeMatchQueue<TItem extends { id: string }> = {
  /** The queue of base charges under review, in queue order */
  items: TItem[];
  /** Index of the currently viewed base charge */
  activeIndex: number;
  /** The currently viewed base charge, or null once the queue is exhausted */
  activeItem: TItem | null;
  /** True when the user stepped past the last item */
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
 * State resets whenever a new `items` array arrives (new page or filters).
 */
export function useChargeMatchQueue<TItem extends { id: string }>(
  items: TItem[],
): UseChargeMatchQueue<TItem> {
  const [activeIndex, setActiveIndex] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, ChargeMatchItemStatus>>({});

  // Reset session state when the queue itself is replaced (render-phase
  // adjustment, per React's "storing information from previous renders").
  // Items are compared by id rather than reference, so a parent re-render
  // that rebuilds an identical array doesn't wipe the user's progress
  const [prevItems, setPrevItems] = useState(items);
  const itemsChanged =
    items.length !== prevItems.length ||
    items.some((item, index) => item.id !== prevItems[index]?.id);
  if (itemsChanged) {
    setPrevItems(items);
    setActiveIndex(0);
    setOverrides({});
  }

  const statusById = useMemo(() => {
    const statuses: Record<string, ChargeMatchItemStatus> = {};
    for (const item of items) {
      statuses[item.id] = overrides[item.id] ?? 'pending';
    }
    return statuses;
  }, [items, overrides]);

  const advance = useCallback(() => {
    setActiveIndex(index => Math.min(index + 1, items.length));
  }, [items.length]);

  const skipItem = useCallback(
    (id: string) => {
      setOverrides(prev => ({ ...prev, [id]: 'skipped' }));
      advance();
    },
    [advance],
  );

  const acceptItemStatus = useCallback(
    (id: string, success: boolean) => {
      if (!success) {
        // Merge failed: stay on the same charge so the user can retry or skip
        return;
      }
      setOverrides(prev => ({ ...prev, [id]: 'matched' }));
      advance();
    },
    [advance],
  );

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
