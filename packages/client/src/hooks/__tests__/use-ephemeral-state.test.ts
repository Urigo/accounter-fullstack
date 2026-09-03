// @vitest-environment happy-dom

import React, { act, type Dispatch, type SetStateAction } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearEphemeralState, useEphemeralState } from '../use-ephemeral-state.js';

const KEY = 'test_ephemeral_state';

let container: HTMLDivElement;

beforeEach(() => {
  clearEphemeralState(KEY);
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

/** Mounts the hook on a fresh root, emulating navigating to the screen. */
function mount<T>(fallback: T): {
  current: () => T;
  set: (value: SetStateAction<T>) => void;
  unmount: () => void;
} {
  let state: T = fallback;
  let setState: Dispatch<SetStateAction<T>> = () => {};

  function Harness(): null {
    [state, setState] = useEphemeralState(KEY, fallback);
    return null;
  }

  const localRoot = createRoot(container);
  act(() => localRoot.render(React.createElement(Harness)));
  return {
    current: () => state,
    set: value => act(() => setState(value)),
    unmount: () => act(() => localRoot.unmount()),
  };
}

describe('useEphemeralState', () => {
  it('starts from the fallback', () => {
    expect(mount({ a: true }).current()).toEqual({ a: true });
  });

  it('restores the value after an unmount/remount', () => {
    const first = mount<Record<string, boolean>>({});
    first.set({ a: true });
    first.unmount();

    expect(mount<Record<string, boolean>>({}).current()).toEqual({ a: true });
  });

  it('does not touch web storage', () => {
    const hook = mount<Record<string, boolean>>({});
    hook.set({ a: true });
    hook.unmount();

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('starts from the fallback again once cleared', () => {
    const hook = mount<Record<string, boolean>>({});
    hook.set({ a: true });
    hook.unmount();

    clearEphemeralState(KEY);
    expect(mount<Record<string, boolean>>({}).current()).toEqual({});
  });
});
