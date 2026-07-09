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
});
