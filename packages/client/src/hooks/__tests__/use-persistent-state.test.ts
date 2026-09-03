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
