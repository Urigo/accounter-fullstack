import { afterEach, describe, expect, it } from 'vitest';
import { SIDEBAR_WIDTH_PX } from '../../../../hooks/use-sidebar.js';
import {
  clampDockedRatio,
  clampEditSplitRatio,
  dockedWidthStyle,
  editSplitFormWidthStyle,
  editSplitSeparatorAria,
  resolveViewerPlacement,
  type ResolvedViewerPlacement,
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

const DOCKED: ResolvedViewerPlacement = { placement: 'docked', overlayMode: null };
const SHEET: ResolvedViewerPlacement = { placement: 'overlay', overlayMode: 'sheet' };
const FULLSCREEN: ResolvedViewerPlacement = { placement: 'overlay', overlayMode: 'fullscreen' };

describe('resolveViewerPlacement', () => {
  it.each<[string, ResolveViewerPlacementInput, ResolvedViewerPlacement]>([
    ['wide screen, no trigger', { ...WIDE, trigger: null }, DOCKED],
    ['wide screen, trigger omitted', WIDE, DOCKED],
    ['viewport 1023', { viewportWidth: 1023, sidebarWidth: 72 }, FULLSCREEN],
    ['viewport 1024, sidebar minimized', { viewportWidth: 1024, sidebarWidth: 72 }, DOCKED],
    ['viewport 1100, sidebar expanded', { viewportWidth: 1100, sidebarWidth: 240 }, SHEET],
    ['viewport 1140, sidebar expanded', { viewportWidth: 1140, sidebarWidth: 240 }, DOCKED],
  ])('%s', (_, input, expected) => {
    expect(resolveViewerPlacement(input)).toEqual(expected);
  });

  it('opens the overlay sheet for a trigger inside a dialog at 1440px', () => {
    expect(resolveViewerPlacement({ ...WIDE, trigger: inside('dialog') })).toEqual(SHEET);
  });

  it('opens the overlay sheet for a trigger inside an alertdialog', () => {
    expect(resolveViewerPlacement({ ...WIDE, trigger: inside('alertdialog') })).toEqual(SHEET);
  });

  it.each<[string, Element | null]>([
    ['no trigger', null],
    ['a page trigger', document.createElement('button')],
    ['a dialog trigger', inside('dialog')],
  ])('goes full screen at 800px with %s', (_, trigger) => {
    expect(resolveViewerPlacement({ trigger, viewportWidth: 800, sidebarWidth: 72 })).toEqual(
      FULLSCREEN,
    );
  });

  it('detects a menu-trigger ref inside a dialog, though the menu item portals out', () => {
    // The actions menu passes its `DropdownMenuTrigger` button, which stays in the dialog, rather
    // than the item that was clicked, which portals to the body.
    const menuButton = inside('dialog');
    menuButton.setAttribute('aria-haspopup', 'menu');
    const portaledItem = document.createElement('div');
    portaledItem.setAttribute('role', 'menuitem');
    document.body.append(portaledItem);

    expect(resolveViewerPlacement({ ...WIDE, trigger: portaledItem })).toEqual(DOCKED);
    expect(resolveViewerPlacement({ ...WIDE, trigger: menuButton })).toEqual(SHEET);
  });

  it('docks for a trigger outside any dialog', () => {
    expect(resolveViewerPlacement({ ...WIDE, trigger: inside('region') })).toEqual(DOCKED);
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

describe('editSplitFormWidthStyle', () => {
  it.each([
    [null, 'clamp(320px, 50%, 100% - 320px)'],
    [0.42, 'clamp(320px, 42%, 100% - 320px)'],
    [0.61234, 'clamp(320px, 61.23%, 100% - 320px)'],
  ])('ratio %s → %s', (ratio, expected) => {
    expect(editSplitFormWidthStyle(ratio)).toBe(expected);
  });
});

describe('clampEditSplitRatio', () => {
  it.each([
    // [ratio, split width, expected]
    [0.5, 1400, 0.5],
    [0.1, 1400, 320 / 1400],
    [0.95, 1400, 1080 / 1400],
    [0.3, 600, 0.5], // both 320px minimums can't fit: stay even
    [1.4, 0, 1], // unmeasured
    [0.3, 0, 0.3],
  ])('%s of %spx → %s', (ratio, width, expected) => {
    expect(clampEditSplitRatio(ratio, width)).toBeCloseTo(expected);
  });
});

describe('editSplitSeparatorAria', () => {
  it('reports 50% of 0–100 while unmeasured', () => {
    expect(editSplitSeparatorAria(null, null)).toEqual({ now: 50, min: 0, max: 100 });
    expect(editSplitSeparatorAria(0.4, null)).toEqual({ now: 40, min: 0, max: 100 });
  });

  it('reads the default from layout, and a chosen ratio clamped', () => {
    expect(editSplitSeparatorAria(null, { split: 1400, form: 700 })).toEqual({
      now: 50,
      min: 23,
      max: 77,
    });
    expect(editSplitSeparatorAria(0.95, { split: 1400, form: 700 })).toEqual({
      now: 77,
      min: 23,
      max: 77,
    });
  });

  it('pins to 50% when both minimums cannot fit', () => {
    expect(editSplitSeparatorAria(null, { split: 600, form: 320 })).toEqual({
      now: 50,
      min: 50,
      max: 50,
    });
  });
});
