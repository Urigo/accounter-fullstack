/** Below this viewport width the viewer never docks. */
export const DOCK_MIN_VIEWPORT_PX = 1024;
/** The docked column never gets narrower than this. */
export const DOCKED_MIN_PX = 420;
/** The page column keeps at least this much beside the docked column. */
export const PAGE_MIN_PX = 480;

/**
 * Where an opened document shows:
 * - `docked`: the column on the right of the dashboard layout.
 * - `fallback`: the PR 1 drawer, until the Overlay replaces it.
 */
export type DocumentViewerPlacement = 'docked' | 'fallback';

/** Any element inside one of these is in a modal layer, which would cover a docked column. */
const MODAL_SELECTOR = '[role="dialog"],[role="alertdialog"]';

export interface ResolveViewerPlacementInput {
  /** The element that opened the viewer. Inside a modal, docking would land behind its backdrop. */
  trigger?: Element | null;
  viewportWidth: number;
  sidebarWidth: number;
}

/** Decided once, at open time. A later window resize only re-clamps the docked width. */
export function resolveViewerPlacement({
  trigger,
  viewportWidth,
  sidebarWidth,
}: ResolveViewerPlacementInput): DocumentViewerPlacement {
  if (trigger?.closest(MODAL_SELECTOR)) {
    return 'fallback';
  }
  if (viewportWidth < DOCK_MIN_VIEWPORT_PX) {
    return 'fallback';
  }
  if (viewportWidth - sidebarWidth < DOCKED_MIN_PX + PAGE_MIN_PX) {
    return 'fallback';
  }
  return 'docked';
}

/**
 * The layout viewport's width, without a scrollbar. happy-dom reports 0 for `clientWidth`, so the
 * window width stands in there.
 */
export function getViewportWidth(): number {
  return document.documentElement.clientWidth || window.innerWidth;
}

/**
 * The docked column's default width, inside the `clamp()` that enforces both minimums. `41rem`
 * (656px) keeps a readable page when the expanded sidebar leaves less than 1312px beside it; with
 * the sidebar minimized at 1440px, half the space (684px) wins.
 */
export const DEFAULT_DOCKED_WIDTH = 'max(50%, 41rem)';

/** One arrow-key press on the resize handle moves the edge by 2% of the work area. */
export const DOCKED_RATIO_STEP = 0.02;

/**
 * The docked column's CSS width. CSS `clamp()` lets the minimum beat the maximum, so when the
 * window shrinks the column holds 420px and the page column absorbs the shortfall by scrolling,
 * instead of a hard page minimum pushing the column off-screen.
 */
export function dockedWidthStyle(ratio: number | null): string {
  const preferred = ratio == null ? DEFAULT_DOCKED_WIDTH : `${round(ratio * 100)}%`;
  return `clamp(${DOCKED_MIN_PX}px, ${preferred}, 100% - ${PAGE_MIN_PX}px)`;
}

/**
 * Clamps a docked-width ratio of the work area to the pixel minimums. When both minimums can't
 * fit, the column's own minimum wins, as it does in {@link dockedWidthStyle}. An unmeasured work
 * area (width 0) only clamps to 0–1.
 */
export function clampDockedRatio(ratio: number, workAreaWidth: number): number {
  if (!Number.isFinite(workAreaWidth) || workAreaWidth <= 0) {
    return Math.min(Math.max(ratio, 0), 1);
  }
  const min = Math.min(DOCKED_MIN_PX / workAreaWidth, 1);
  const max = Math.max(min, (workAreaWidth - PAGE_MIN_PX) / workAreaWidth);
  return Math.min(Math.max(ratio, min), max);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
