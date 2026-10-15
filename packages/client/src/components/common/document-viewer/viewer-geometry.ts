import type { FitMode, Point, Rotation, Size, ZoomMode } from './types.js';

/**
 * All of the viewer's zoom and scroll math, kept free of the DOM so it can be tested directly.
 *
 * Two viewport shapes appear below. `fitZoom` and `zoomBounds` take the *available* area, which is
 * the scroll box's client size minus the canvas padding on each side (`innerViewport`). The scroll
 * helpers take the scroll box's client size itself plus the padding, because that is the frame
 * `scrollLeft`/`scrollTop` are measured in.
 */

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.25;
export const DOUBLE_CLICK_ZOOM = 2;
export const WHEEL_LINE_PX = 16;

/** A step that lands within this distance of 100% snaps to it. */
const SNAP_TO_ACTUAL = 0.02;
/** How strongly one wheel pixel zooms: one 100px mouse notch hits the 1.25 clamp, i.e. one step. */
const WHEEL_SENSITIVITY = 0.01;

export function innerViewport(viewport: Size, padding: number): Size {
  return {
    width: Math.max(0, viewport.width - 2 * padding),
    height: Math.max(0, viewport.height - 2 * padding),
  };
}

export function rotatedSize(natural: Size, r: Rotation): Size {
  return r === 90 || r === 270 ? { width: natural.height, height: natural.width } : { ...natural };
}

/** Zoom for a fit mode. Fit width and fit page never upscale past the image's natural size. */
export function fitZoom(mode: FitMode, natural: Size, viewport: Size, r: Rotation): number {
  if (mode === 'actual') {
    return 1;
  }
  const rotated = rotatedSize(natural, r);
  if (rotated.width <= 0 || rotated.height <= 0 || viewport.width <= 0) {
    return 1;
  }
  const byWidth = viewport.width / rotated.width;
  if (mode === 'width') {
    return Math.min(1, byWidth);
  }
  const byHeight = viewport.height > 0 ? viewport.height / rotated.height : byWidth;
  return Math.min(1, byWidth, byHeight);
}

/** The minimum drops below 25% when that is what it takes for Fit page to show a tall scan whole. */
export function zoomBounds(
  natural: Size,
  viewport: Size,
  r: Rotation,
): { min: number; max: number } {
  return { min: Math.min(MIN_ZOOM, fitZoom('page', natural, viewport, r)), max: MAX_ZOOM };
}

export function clampZoom(zoom: number, b: { min: number; max: number }): number {
  if (!Number.isFinite(zoom)) {
    return b.min;
  }
  return Math.min(b.max, Math.max(b.min, zoom));
}

/** One +/− step. Crossing 100%, or landing within 2% of it, stops at exactly 100%. */
export function stepZoom(zoom: number, dir: 1 | -1, b: { min: number; max: number }): number {
  let next = dir > 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
  const crossedActual = (zoom < 1 && next > 1) || (zoom > 1 && next < 1);
  if (crossedActual || Math.abs(next - 1) <= SNAP_TO_ACTUAL) {
    next = 1;
  }
  return clampZoom(next, b);
}

/** Size of the page box: the rotated bounding box, scaled. */
export function displaySize(natural: Size, zoom: number, r: Rotation): Size {
  const rotated = rotatedSize(natural, r);
  return { width: rotated.width * zoom, height: rotated.height * zoom };
}

/**
 * Where the page box's top-left sits in scroll-content coordinates: centred horizontally while it
 * is narrower than the pane, and always top-aligned below the padding.
 */
export function contentOrigin(display: Size, viewport: Size, padding: number): Point {
  return {
    x: padding + Math.max(0, (viewport.width - 2 * padding - display.width) / 2),
    y: padding,
  };
}

function contentSize(display: Size, viewport: Size, padding: number): Size {
  return {
    width: Math.max(viewport.width, display.width + 2 * padding),
    height: Math.max(viewport.height, display.height + 2 * padding),
  };
}

export function clampScroll(scroll: Point, display: Size, viewport: Size, padding: number): Point {
  const content = contentSize(display, viewport, padding);
  const maxX = Math.max(0, content.width - viewport.width);
  const maxY = Math.max(0, content.height - viewport.height);
  return {
    x: Math.min(maxX, Math.max(0, scroll.x)),
    y: Math.min(maxY, Math.max(0, scroll.y)),
  };
}

/**
 * The scroll position that keeps the content point under `anchor` (relative to the scroll box's
 * visible top-left) in place when the zoom changes from `zoom` to `nextZoom`.
 */
export function zoomAt(i: {
  natural: Size;
  rotation: Rotation;
  viewport: Size;
  padding: number;
  zoom: number;
  nextZoom: number;
  scroll: Point;
  anchor: Point;
}): Point {
  const display = displaySize(i.natural, i.zoom, i.rotation);
  const nextDisplay = displaySize(i.natural, i.nextZoom, i.rotation);
  const origin = contentOrigin(display, i.viewport, i.padding);
  const nextOrigin = contentOrigin(nextDisplay, i.viewport, i.padding);
  const ratio = i.zoom > 0 ? i.nextZoom / i.zoom : 1;

  const pageX = i.scroll.x + i.anchor.x - origin.x;
  const pageY = i.scroll.y + i.anchor.y - origin.y;

  return clampScroll(
    {
      x: nextOrigin.x + pageX * ratio - i.anchor.x,
      y: nextOrigin.y + pageY * ratio - i.anchor.y,
    },
    nextDisplay,
    i.viewport,
    i.padding,
  );
}

/** Wheel delta in pixels: Firefox can report lines (`deltaMode` 1) or pages (`deltaMode` 2). */
export function normalizeWheelDeltaY(
  e: { deltaY: number; deltaMode: number },
  pageHeightPx: number,
): number {
  if (e.deltaMode === 1) {
    return e.deltaY * WHEEL_LINE_PX;
  }
  if (e.deltaMode === 2) {
    return e.deltaY * pageHeightPx;
  }
  return e.deltaY;
}

/** Zoom factor for one wheel event. Small trackpad-pinch deltas stay smooth; a notch is one step. */
export function wheelZoomFactor(deltaYPx: number): number {
  const factor = Math.exp(-deltaYPx * WHEEL_SENSITIVITY);
  return Math.min(ZOOM_STEP, Math.max(1 / ZOOM_STEP, factor));
}

export function pinchZoomFactor(prevDistance: number, nextDistance: number): number {
  if (prevDistance <= 0 || nextDistance <= 0) {
    return 1;
  }
  return nextDistance / prevDistance;
}

/**
 * Double-click / double-tap target: from a fit mode, go to 200%; from a custom zoom, return to the
 * last fit mode. `fit` is the zoom that last fit mode resolves to right now.
 */
export function doubleClickTarget(
  s: { mode: ZoomMode; lastFit: FitMode },
  fit: number,
): { mode: ZoomMode; zoom: number } {
  if (s.mode === 'custom') {
    return { mode: s.lastFit, zoom: fit };
  }
  return { mode: 'custom', zoom: DOUBLE_CLICK_ZOOM };
}
