// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import {
  useChargeMatchQueue,
  type UseChargeMatchQueue,
} from '../use-charge-match-queue.js';

type Item = { id: string; label?: string };

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

async function renderQueueHarness(initialItems: Item[]) {
  const container = document.createElement('div');
  document.body.append(container);

  let latest: UseChargeMatchQueue<Item> | null = null;

  function Harness({ items }: { items: Item[] }): null {
    latest = useChargeMatchQueue(items);
    return null;
  }

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(Harness, { items: initialItems }));
    await Promise.resolve();
  });

  const rerender = async (items: Item[]) => {
    await act(async () => {
      root?.render(React.createElement(Harness, { items }));
      await Promise.resolve();
    });
  };

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  const current = () => {
    if (!latest) {
      throw new Error('Hook value not captured');
    }
    return latest;
  };

  return { current, rerender, cleanup };
}

const ITEMS: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('useChargeMatchQueue', () => {
  it('maintains the items array with the first item active and all statuses pending', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    expect(current().items).toEqual(ITEMS);
    expect(current().activeIndex).toBe(0);
    expect(current().activeItem).toEqual({ id: 'a' });
    expect(current().isDone).toBe(false);
    expect(current().statusById).toEqual({ a: 'pending', b: 'pending', c: 'pending' });

    await cleanup();
  });

  it('skipItem flags the id as skipped and increments activeIndex', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().skipItem('a');
    });

    expect(current().statusById.a).toBe('skipped');
    expect(current().activeIndex).toBe(1);
    expect(current().activeItem).toEqual({ id: 'b' });

    await cleanup();
  });

  it('acceptItemStatus with success flags the id as matched and increments activeIndex', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().acceptItemStatus('a', true);
    });

    expect(current().statusById.a).toBe('matched');
    expect(current().activeIndex).toBe(1);
    expect(current().activeItem).toEqual({ id: 'b' });

    await cleanup();
  });

  it('acceptItemStatus with failure keeps the active item and status untouched', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().acceptItemStatus('a', false);
    });

    expect(current().statusById.a).toBe('pending');
    expect(current().activeIndex).toBe(0);
    expect(current().activeItem).toEqual({ id: 'a' });

    await cleanup();
  });

  it('marks the queue as done once every item was resolved', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().skipItem('a');
    });
    await act(async () => {
      current().acceptItemStatus('b', true);
    });
    await act(async () => {
      current().skipItem('c');
    });

    expect(current().isDone).toBe(true);
    expect(current().activeItem).toBeNull();
    expect(current().statusById).toEqual({ a: 'skipped', b: 'matched', c: 'skipped' });

    await cleanup();
  });

  it('selectItem pins an upcoming base charge as the active item', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().selectItem('c');
    });

    expect(current().activeIndex).toBe(2);
    expect(current().activeItem).toEqual({ id: 'c' });
    // No item has been resolved, so the queue is not done
    expect(current().isDone).toBe(false);

    await cleanup();
  });

  it('selectItem can revisit a skipped base charge', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().skipItem('a');
    });
    expect(current().activeItem).toEqual({ id: 'b' });

    await act(async () => {
      current().selectItem('a');
    });
    expect(current().activeIndex).toBe(0);
    expect(current().activeItem).toEqual({ id: 'a' });
    expect(current().statusById.a).toBe('skipped');

    await cleanup();
  });

  it('resolving a manually selected charge clears the pin and advances to the next pending', async () => {
    const { current, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().selectItem('c');
    });
    expect(current().activeItem).toEqual({ id: 'c' });

    await act(async () => {
      current().acceptItemStatus('c', true);
    });

    // Pin cleared: falls back to the first still-pending charge
    expect(current().statusById.c).toBe('matched');
    expect(current().activeItem).toEqual({ id: 'a' });

    await cleanup();
  });

  it('selecting a charge that leaves the queue on refetch falls back to first-pending', async () => {
    const { current, rerender, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().selectItem('c');
    });
    expect(current().activeItem).toEqual({ id: 'c' });

    const refetchedItems: Item[] = [{ id: 'a' }, { id: 'b' }];
    await rerender(refetchedItems);

    expect(current().activeItem).toEqual({ id: 'a' });

    await cleanup();
  });

  it('resets index and statuses when a new items array arrives (e.g. filters changed)', async () => {
    const { current, rerender, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().skipItem('a');
    });
    expect(current().activeIndex).toBe(1);

    const nextItems: Item[] = [{ id: 'x' }, { id: 'y' }];
    await rerender(nextItems);

    expect(current().items).toEqual(nextItems);
    expect(current().activeIndex).toBe(0);
    expect(current().activeItem).toEqual({ id: 'x' });
    expect(current().statusById).toEqual({ x: 'pending', y: 'pending' });

    await cleanup();
  });

  it('preserves progress when the item set changes, e.g. a merged charge drops out on refetch', async () => {
    const { current, rerender, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().skipItem('a');
    });
    await act(async () => {
      current().acceptItemStatus('b', true);
    });
    expect(current().activeItem).toEqual({ id: 'c' });

    // Refetch after the merge: charge "b" no longer exists in the queue
    const refetchedItems: Item[] = [{ id: 'a' }, { id: 'c' }];
    await rerender(refetchedItems);

    expect(current().statusById).toEqual({ a: 'skipped', c: 'pending' });
    expect(current().activeItem).toEqual({ id: 'c' });
    expect(current().isDone).toBe(false);

    await cleanup();
  });

  it('does not reset state when a new array reference holds the same items (parent re-render)', async () => {
    const { current, rerender, cleanup } = await renderQueueHarness(ITEMS);

    await act(async () => {
      current().skipItem('a');
    });
    expect(current().activeIndex).toBe(1);

    const sameItemsNewRef: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    await rerender(sameItemsNewRef);

    expect(current().activeIndex).toBe(1);
    expect(current().activeItem).toEqual({ id: 'b' });
    expect(current().statusById.a).toBe('skipped');

    await cleanup();
  });
});
