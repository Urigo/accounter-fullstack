import { afterEach, describe, expect, it } from 'vitest';
import { SIDEBAR_WIDTH_PX } from '../../../../hooks/use-sidebar.js';
import {
  clampDockedRatio,
  dockedWidthStyle,
  resolveViewerPlacement,
  type ResolveViewerPlacementInput,
} from '../placement.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function inside(role: string): HTMLElement {
  const layer = document.createElement('div');
  layer.setAttribute('role', role);
  const wrapper = document.createElement('div');
  const button = document.createElement('button');
  wrapper.append(button);
  layer.append(wrapper);
  document.body.append(layer);
  return button;
}

const WIDE = { viewportWidth: 1440, sidebarWidth: SIDEBAR_WIDTH_PX.minimized };

describe('resolveViewerPlacement', () => {
  it.each<[string, ResolveViewerPlacementInput, 'docked' | 'fallback']>([
    ['wide screen, no trigger', { ...WIDE, trigger: null }, 'docked'],
    ['wide screen, trigger omitted', WIDE, 'docked'],
    ['viewport 1023', { viewportWidth: 1023, sidebarWidth: 72 }, 'fallback'],
    ['viewport 1024, sidebar minimized', { viewportWidth: 1024, sidebarWidth: 72 }, 'docked'],
    ['viewport 1100, sidebar expanded', { viewportWidth: 1100, sidebarWidth: 240 }, 'fallback'],
    ['viewport 1140, sidebar expanded', { viewportWidth: 1140, sidebarWidth: 240 }, 'docked'],
  ])('%s → %s', (_, input, expected) => {
    expect(resolveViewerPlacement(input)).toBe(expected);
  });

  it('falls back for a trigger inside a dialog', () => {
    expect(resolveViewerPlacement({ ...WIDE, trigger: inside('dialog') })).toBe('fallback');
  });

  it('falls back for a trigger inside an alertdialog', () => {
    expect(resolveViewerPlacement({ ...WIDE, trigger: inside('alertdialog') })).toBe('fallback');
  });

  it('docks for a trigger outside any dialog', () => {
    expect(resolveViewerPlacement({ ...WIDE, trigger: inside('region') })).toBe('docked');
  });
});

describe('dockedWidthStyle', () => {
  it('uses the default width inside the clamp', () => {
    expect(dockedWidthStyle(null)).toBe('clamp(420px, max(50%, 41rem), 100% - 480px)');
  });

  it('uses a ratio as a percentage', () => {
    expect(dockedWidthStyle(0.52)).toBe('clamp(420px, 52%, 100% - 480px)');
    expect(dockedWidthStyle(1 / 3)).toBe('clamp(420px, 33.33%, 100% - 480px)');
  });
});

describe('clampDockedRatio', () => {
  it('keeps a ratio that fits both minimums', () => {
    expect(clampDockedRatio(0.5, 1368)).toBe(0.5);
  });

  it('keeps the docked column at least 420px', () => {
    expect(clampDockedRatio(0.1, 1000)).toBeCloseTo(0.42);
  });

  it('keeps the page column at least 480px', () => {
    expect(clampDockedRatio(0.9, 1000)).toBeCloseTo(0.52);
  });

  it('lets the docked minimum win when both cannot fit', () => {
    expect(clampDockedRatio(0.9, 800)).toBeCloseTo(420 / 800);
  });

  it('clamps to 0–1 when the work area is unmeasured', () => {
    expect(clampDockedRatio(1.4, 0)).toBe(1);
    expect(clampDockedRatio(0.52, 0)).toBe(0.52);
  });
});
