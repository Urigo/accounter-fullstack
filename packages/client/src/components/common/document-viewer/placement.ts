/** Below this viewport width the viewer never docks. */
export const DOCK_MIN_VIEWPORT_PX = 1024;
/** The docked column never gets narrower than this. */
export const DOCKED_MIN_PX = 420;
/** The page column keeps at least this much beside the docked column. */
export const PAGE_MIN_PX = 480;

/**
 * Where an opened document shows:
 * - `docked`: the column on the right of the dashboard layout.
 * - `overlay`: a modal layer above everything else, an open dialog included. {@link OverlayMode}
 *   says which shape.
 */
export type DocumentViewerPlacement = 'docked' | 'overlay';

/**
 * The overlay's shape:
 * - `fullscreen`: the whole viewport, under 1024px. It owns a history entry, so Back closes it.
 * - `sheet`: a full-height right sheet with no backdrop, from 1024px up wherever the viewer can't
 *   dock (the trigger is inside a modal, or both docked minimums don't fit). A modal under it stays
 *   visible on the left.
 */
export type OverlayMode = 'fullscreen' | 'sheet';

export type ResolvedViewerPlacement =
  { placement: 'docked'; overlayMode: null } | { placement: 'overlay'; overlayMode: OverlayMode };

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
}: ResolveViewerPlacementInput): ResolvedViewerPlacement {
  if (viewportWidth < DOCK_MIN_VIEWPORT_PX) {
    // Phones and tablets get the whole screen, whether the trigger is in a modal or not.
    return { placement: 'overlay', overlayMode: 'fullscreen' };
  }
  if (
    trigger?.closest(MODAL_SELECTOR) ||
    viewportWidth - sidebarWidth < DOCKED_MIN_PX + PAGE_MIN_PX
  ) {
    return { placement: 'overlay', overlayMode: 'sheet' };
  }
  return { placement: 'docked', overlayMode: null };
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

/** Each pane of the edit-sheet split keeps at least this much (`min-w-80`). */
export const EDIT_PANE_MIN_PX = 320;

/** The edit split's default: half the sheet for the form, half for the viewer. */
export const DEFAULT_EDIT_SPLIT_RATIO = 0.5;

/** One arrow-key press on the split handle moves it by 2% of the split's width. */
export const EDIT_SPLIT_RATIO_STEP = 0.02;

/**
 * The form pane's CSS width in the edit split, as a share of the split. The `clamp()` keeps both
 * panes at their minimum while the sheet resizes; the viewer pane takes the rest.
 */
export function editSplitFormWidthStyle(ratio: number | null): string {
  const preferred = `${round((ratio ?? DEFAULT_EDIT_SPLIT_RATIO) * 100)}%`;
  return `clamp(${EDIT_PANE_MIN_PX}px, ${preferred}, 100% - ${EDIT_PANE_MIN_PX}px)`;
}

/**
 * Clamps the form pane's share of the edit split so both panes keep their minimum. When both can't
 * fit, the split stays even. An unmeasured split (width 0) only clamps to 0–1.
 */
export function clampEditSplitRatio(ratio: number, splitWidth: number): number {
  if (!Number.isFinite(splitWidth) || splitWidth <= 0) {
    return Math.min(Math.max(ratio, 0), 1);
  }
  const min = EDIT_PANE_MIN_PX / splitWidth;
  const max = (splitWidth - EDIT_PANE_MIN_PX) / splitWidth;
  if (max < min) {
    return DEFAULT_EDIT_SPLIT_RATIO;
  }
  return Math.min(Math.max(ratio, min), max);
}

/**
 * The edit split handle's ARIA value: the form pane's width as a whole percentage of the split,
 * with the bounds both pane minimums allow. Matches the docked column's `separatorAria`: a chosen
 * ratio is reported at once, already clamped; the default comes from layout. Unmeasured, it
 * reports 50% of 0–100.
 */
export function editSplitSeparatorAria(
  ratio: number | null,
  layout: { split: number; form: number } | null,
): { now: number; min: number; max: number } {
  const split = layout?.split ?? 0;
  const form = layout?.form ?? 0;
  const percent = (value: number): number => Math.round(value * 100);
  if (split <= 0) {
    return { now: percent(ratio ?? DEFAULT_EDIT_SPLIT_RATIO), min: 0, max: 100 };
  }
  const min = clampEditSplitRatio(0, split);
  const max = clampEditSplitRatio(1, split);
  const now = clampEditSplitRatio(
    ratio ?? (form > 0 ? form / split : DEFAULT_EDIT_SPLIT_RATIO),
    split,
  );
  return { now: percent(now), min: percent(min), max: percent(max) };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
