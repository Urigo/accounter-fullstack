import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCKED_RATIO_KEY,
  EDIT_PANE_HIDDEN_KEY,
  EDIT_SPLIT_RATIO_KEY,
  reviveBoolean,
  reviveRatio,
  usePersistedRatio,
  type PersistedRatio,
} from '../persisted-sizes.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('storage keys', () => {
  it('uses the namespaced keys', () => {
    expect([DOCKED_RATIO_KEY, EDIT_SPLIT_RATIO_KEY, EDIT_PANE_HIDDEN_KEY]).toEqual([
      'accounter:document-viewer:docked-ratio',
      'accounter:document-viewer:edit-split-ratio',
      'accounter:document-viewer:edit-pane-hidden',
    ]);
  });
});

describe('reviveRatio', () => {
  it.each([
    ['null, the default width', null, null],
    ['a ratio in range', 0.42, 0.42],
    ['a small ratio, clamped up', 0.05, 0.2],
    ['a large ratio, clamped down', 0.95, 0.8],
  ])('accepts %s', (_, stored, expected) => {
    expect(reviveRatio(stored, 0.5)).toBe(expected);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['0', 0],
    ['1', 1],
    ['a value above 1', 1.5],
    ['a negative value', -0.3],
    ['a string', '0.5'],
    ['an object', { ratio: 0.5 }],
    ['undefined', undefined],
  ])('rejects %s', (_, stored) => {
    expect(reviveRatio(stored, 0.5)).toBe(0.5);
    expect(reviveRatio(stored, null)).toBeNull();
  });
});

describe('reviveBoolean', () => {
  it('accepts booleans only', () => {
    expect(reviveBoolean(true, false)).toBe(true);
    expect(reviveBoolean(false, true)).toBe(false);
    expect(reviveBoolean('true', false)).toBe(false);
    expect(reviveBoolean(1, false)).toBe(false);
    expect(reviveBoolean(null, true)).toBe(true);
  });
});

describe('usePersistedRatio', () => {
  const KEY = 'test:ratio';
  let container: HTMLDivElement;
  let root: Root;
  let api: PersistedRatio;

  function Probe(): null {
    api = usePersistedRatio(KEY);
    return null;
  }

  function render(): void {
    act(() => root.render(<Probe />));
  }

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('starts at the default, and falls back on a corrupt entry', () => {
    localStorage.setItem(KEY, '{not json');
    render();
    expect(api.ratio).toBeNull();
  });

  it('reads a stored ratio back, clamped', () => {
    localStorage.setItem(KEY, '0.9');
    render();
    expect(api.ratio).toBe(0.8);
  });

  it('keeps a drag local and writes storage once, on commit', () => {
    render();
    const setItem = vi.spyOn(localStorage, 'setItem');
    act(() => api.preview(0.3));
    act(() => api.preview(0.35));
    act(() => api.preview(0.4));
    expect(api.ratio).toBe(0.4);
    expect(setItem).not.toHaveBeenCalled();

    act(() => api.commit());
    expect(api.ratio).toBe(0.4);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBe('0.4');

    // A second commit with no drag in between changes nothing.
    act(() => api.commit());
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('set() stores at once, and null resets to the default', () => {
    render();
    act(() => api.set(0.6));
    expect(localStorage.getItem(KEY)).toBe('0.6');
    act(() => api.set(null));
    expect(api.ratio).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('null');
  });

  it('survives storage that throws, as in a locked-down private window', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render();
    expect(api.ratio).toBeNull();
    act(() => api.set(0.6));
    expect(api.ratio).toBe(0.6);
  });
});
