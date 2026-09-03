// @vitest-environment happy-dom

import React, { act, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistentState } from '../use-persistent-state.js';

const KEY = 'test_persistent_state';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

/** Mounts the hook and exposes the latest state and setter. */
function mount<T>(
  fallback: T,
  revive?: (parsed: unknown, fallback: T) => T,
): { current: () => T; set: (value: SetStateAction<T>) => void } {
  let state: T = fallback;
  let setState: Dispatch<SetStateAction<T>> = () => {};

  function Harness(): null {
    [state, setState] = usePersistentState(KEY, fallback, revive);
    return null;
  }

  act(() => root.render(React.createElement(Harness)));
  return {
    current: () => state,
    set: value => act(() => setState(value)),
  };
}

/** Mounts the hook with a `storageKey` that can be changed after mount. */
function mountWithKey<T>(
  initialKey: string,
  fallback: T,
): { current: () => T; setKey: (key: string) => void } {
  let state: T = fallback;

  function Harness({ storageKey }: { storageKey: string }): null {
    [state] = usePersistentState(storageKey, fallback);
    return null;
  }

  const render = (storageKey: string): void => {
    act(() => root.render(React.createElement(Harness, { storageKey })));
  };

  render(initialKey);
  return { current: () => state, setKey: render };
}

describe('usePersistentState', () => {
  it('starts from the fallback and writes it to localStorage', () => {
    const hook = mount({ name: true });
    expect(hook.current()).toEqual({ name: true });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ name: true });
  });

  it('persists updates', () => {
    const hook = mount<string[]>([]);
    hook.set(['a']);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['a']);
  });

  it('restores a stored value on a later mount', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: false }));
    const hook = mount({ name: true });
    expect(hook.current()).toEqual({ name: false });
  });

  it('passes the stored value through `revive`', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: false }));
    const hook = mount({ name: true, city: true }, (parsed, fallback) => ({
      ...fallback,
      ...(parsed as Record<string, boolean>),
    }));
    expect(hook.current()).toEqual({ name: false, city: true });
  });

  it('falls back when the stored value is not valid JSON', () => {
    localStorage.setItem(KEY, '{not json');
    const hook = mount({ name: true });
    expect(hook.current()).toEqual({ name: true });
  });

  it('falls back when `revive` throws', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: false }));
    const hook = mount({ name: true }, () => {
      throw new Error('bad shape');
    });
    expect(hook.current()).toEqual({ name: true });
  });

  it('re-hydrates from a changed storageKey', () => {
    localStorage.setItem('key_a', JSON.stringify(['from a']));
    localStorage.setItem('key_b', JSON.stringify(['from b']));

    const hook = mountWithKey<string[]>('key_a', []);
    expect(hook.current()).toEqual(['from a']);

    hook.setKey('key_b');
    expect(hook.current()).toEqual(['from b']);
    // The old key's value must not leak into the new key.
    expect(JSON.parse(localStorage.getItem('key_b')!)).toEqual(['from b']);
  });

  it('falls back when a changed storageKey has nothing stored', () => {
    localStorage.setItem('key_a', JSON.stringify(['from a']));

    const hook = mountWithKey<string[]>('key_a', []);
    hook.setKey('key_unstored');

    expect(hook.current()).toEqual([]);
  });

  it('keeps working when localStorage writes fail', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const hook = mount<string[]>([]);
    hook.set(['a']);

    expect(hook.current()).toEqual(['a']);
    expect(warn).toHaveBeenCalled();
  });
});
