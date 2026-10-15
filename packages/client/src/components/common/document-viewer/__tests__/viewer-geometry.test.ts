import { describe, expect, it } from 'vitest';
import type { Point, Rotation, Size } from '../types.js';
import {
  clampScroll,
  clampZoom,
  contentOrigin,
  displaySize,
  doubleClickTarget,
  fitZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeWheelDeltaY,
  pinchZoomFactor,
  rotatedSize,
  stepZoom,
  wheelZoomFactor,
  zoomAt,
  zoomBounds,
} from '../viewer-geometry.js';

const A4: Size = { width: 2480, height: 3508 };
const PANE: Size = { width: 650, height: 800 };
const BOUNDS = { min: MIN_ZOOM, max: MAX_ZOOM };

describe('rotatedSize', () => {
  it.each<[Rotation, Size]>([
    [0, { width: 2480, height: 3508 }],
    [90, { width: 3508, height: 2480 }],
    [180, { width: 2480, height: 3508 }],
    [270, { width: 3508, height: 2480 }],
  ])('rotation %i', (rotation, expected) => {
    expect(rotatedSize(A4, rotation)).toEqual(expected);
  });
});

describe('fitZoom', () => {
  it.each<[string, Size, Rotation, number, number]>([
    // name, natural, rotation, fit width, fit page
    ['A4 portrait', A4, 0, 650 / 2480, 800 / 3508],
    ['landscape', { width: 3508, height: 2480 }, 0, 650 / 3508, 650 / 3508],
    ['long receipt', { width: 576, height: 4000 }, 0, 1, 800 / 4000],
    ['small image, capped at 1', { width: 300, height: 200 }, 0, 1, 1],
    ['A4 rotated 90°', A4, 90, 650 / 3508, 650 / 3508],
  ])('%s', (_name, natural, rotation, width, page) => {
    expect(fitZoom('width', natural, PANE, rotation)).toBeCloseTo(width, 10);
    expect(fitZoom('page', natural, PANE, rotation)).toBeCloseTo(page, 10);
    expect(fitZoom('actual', natural, PANE, rotation)).toBe(1);
  });

  it('falls back to 1 for an empty pane or image', () => {
    expect(fitZoom('width', { width: 0, height: 0 }, PANE, 0)).toBe(1);
    expect(fitZoom('page', A4, { width: 0, height: 0 }, 0)).toBe(1);
  });
});

describe('zoomBounds', () => {
  it('uses 25% to 800% when Fit page is above 25%', () => {
    expect(zoomBounds({ width: 1240, height: 1754 }, PANE, 0)).toEqual({
      min: MIN_ZOOM,
      max: MAX_ZOOM,
    });
  });

  it('follows Fit page when even an A4 scan needs less than 25%', () => {
    expect(zoomBounds(A4, PANE, 0).min).toBeCloseTo(800 / 3508, 10);
  });

  it('drops the minimum below 25% so Fit page shows a very tall receipt whole', () => {
    const { min } = zoomBounds({ width: 600, height: 9000 }, PANE, 0);
    expect(min).toBeLessThan(MIN_ZOOM);
    expect(min).toBeCloseTo(800 / 9000, 10);
  });
});

describe('clampZoom', () => {
  it.each([
    [0.1, MIN_ZOOM],
    [1.5, 1.5],
    [20, MAX_ZOOM],
    [Number.NaN, MIN_ZOOM],
  ])('%f → %f', (zoom, expected) => {
    expect(clampZoom(zoom, BOUNDS)).toBe(expected);
  });
});

describe('stepZoom', () => {
  it('multiplies and divides by 1.25', () => {
    expect(stepZoom(2, 1, BOUNDS)).toBeCloseTo(2.5, 10);
    expect(stepZoom(2, -1, BOUNDS)).toBeCloseTo(1.6, 10);
  });

  it('stops at 100% when a step crosses it', () => {
    expect(stepZoom(0.9, 1, BOUNDS)).toBe(1);
    expect(stepZoom(1.1, -1, BOUNDS)).toBe(1);
  });

  it('snaps to 100% within 2%', () => {
    expect(stepZoom(0.8, 1, BOUNDS)).toBe(1);
    expect(stepZoom(1.01 * 1.25, -1, BOUNDS)).toBe(1);
  });

  it('leaves 100% on the next step', () => {
    expect(stepZoom(1, 1, BOUNDS)).toBeCloseTo(1.25, 10);
    expect(stepZoom(1, -1, BOUNDS)).toBeCloseTo(0.8, 10);
  });

  it('clamps at both ends', () => {
    expect(stepZoom(7, 1, BOUNDS)).toBe(MAX_ZOOM);
    expect(stepZoom(0.26, -1, BOUNDS)).toBe(MIN_ZOOM);
  });
});

describe('displaySize and contentOrigin', () => {
  it('scales the rotated box', () => {
    expect(displaySize({ width: 100, height: 200 }, 2, 90)).toEqual({ width: 400, height: 200 });
  });

  it('centres a narrow page and top-aligns it', () => {
    expect(contentOrigin({ width: 200, height: 900 }, { width: 616, height: 500 }, 8)).toEqual({
      x: 208,
      y: 8,
    });
  });

  it('pins a wide page to the padding', () => {
    expect(contentOrigin({ width: 2000, height: 900 }, { width: 616, height: 500 }, 8)).toEqual({
      x: 8,
      y: 8,
    });
  });
});

describe('clampScroll', () => {
  const display = { width: 1000, height: 2000 };
  const viewport = { width: 500, height: 600 };

  it.each<[Point, Point]>([
    [
      { x: -10, y: -10 },
      { x: 0, y: 0 },
    ],
    [
      { x: 100, y: 200 },
      { x: 100, y: 200 },
    ],
    [
      { x: 9999, y: 9999 },
      { x: 516, y: 1416 },
    ],
  ])('%o → %o', (scroll, expected) => {
    expect(clampScroll(scroll, display, viewport, 8)).toEqual(expected);
  });

  it('allows no scroll when the page fits', () => {
    expect(clampScroll({ x: 50, y: 50 }, { width: 100, height: 100 }, viewport, 8)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('zoomAt', () => {
  const padding = 8;
  const natural = { width: 1000, height: 1400 };
  const viewport = { width: 600, height: 700 };

  /** The point on the unscaled page under `anchor`. */
  function pagePointUnder(zoom: number, scroll: Point, anchor: Point): Point {
    const display = displaySize(natural, zoom, 0);
    const origin = contentOrigin(display, viewport, padding);
    return {
      x: (scroll.x + anchor.x - origin.x) / zoom,
      y: (scroll.y + anchor.y - origin.y) / zoom,
    };
  }

  it.each<[string, number, number, Point, Point]>([
    ['centred page zooming in', 0.4, 1.5, { x: 0, y: 0 }, { x: 300, y: 200 }],
    ['scrolled page zooming in', 1.5, 3, { x: 400, y: 600 }, { x: 120, y: 340 }],
    ['scrolled page zooming out', 3, 2, { x: 1200, y: 1500 }, { x: 500, y: 100 }],
  ])('keeps the anchor fixed: %s', (_name, zoom, nextZoom, scroll, anchor) => {
    const before = pagePointUnder(zoom, scroll, anchor);
    const next = zoomAt({
      natural,
      rotation: 0,
      viewport,
      padding,
      zoom,
      nextZoom,
      scroll,
      anchor,
    });
    const after = pagePointUnder(nextZoom, next, anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('clamps at the edge instead of scrolling past the page', () => {
    const next = zoomAt({
      natural,
      rotation: 0,
      viewport,
      padding,
      zoom: 2,
      nextZoom: 0.3,
      scroll: { x: 1300, y: 2000 },
      anchor: { x: 0, y: 0 },
    });
    expect(next).toEqual({ x: 0, y: 0 });
  });
});

describe('wheel and pinch', () => {
  it.each([
    [0, 3, 3],
    [1, 3, 48],
    [2, 1, 700],
  ])('normalizes deltaMode %i', (deltaMode, deltaY, expected) => {
    expect(normalizeWheelDeltaY({ deltaMode, deltaY }, 700)).toBe(expected);
  });

  it('turns one mouse notch into one step', () => {
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.25, 10);
    expect(wheelZoomFactor(100)).toBeCloseTo(0.8, 10);
  });

  it('keeps small trackpad deltas smooth', () => {
    expect(wheelZoomFactor(-2)).toBeCloseTo(Math.exp(0.02), 10);
    expect(wheelZoomFactor(0)).toBe(1);
  });

  it('scales a pinch by the distance ratio', () => {
    expect(pinchZoomFactor(100, 150)).toBe(1.5);
    expect(pinchZoomFactor(0, 150)).toBe(1);
  });
});

describe('doubleClickTarget', () => {
  it('goes from a fit mode to 200%', () => {
    expect(doubleClickTarget({ mode: 'width', lastFit: 'width' }, 0.3)).toEqual({
      mode: 'custom',
      zoom: 2,
    });
  });

  it('returns from a custom zoom to the last fit', () => {
    expect(doubleClickTarget({ mode: 'custom', lastFit: 'page' }, 0.2)).toEqual({
      mode: 'page',
      zoom: 0.2,
    });
  });
});
