import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../use-media-query.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let matches = false;
let listeners = new Set<() => void>();
const seen: boolean[] = [];

beforeEach(() => {
  matches = false;
  listeners = new Set();
  seen.length = 0;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function Probe(): ReactElement {
  const value = useMediaQuery('(min-width: 64rem)');
  seen.push(value);
  return <span>{String(value)}</span>;
}

describe('useMediaQuery', () => {
  it('has the matching value on the very first render', () => {
    matches = true;
    act(() => root.render(<Probe />));
    expect(seen[0]).toBe(true);
    expect(seen).not.toContain(false);
  });

  it('follows changes and unsubscribes on unmount', () => {
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe('false');
    expect(listeners.size).toBe(1);

    matches = true;
    act(() => listeners.forEach(listener => listener()));
    expect(container.textContent).toBe('true');

    act(() => root.unmount());
    expect(listeners.size).toBe(0);
    // `afterEach` unmounts again; give it a fresh root.
    root = createRoot(container);
  });

  it('is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe('false');
  });
});
