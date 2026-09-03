/**
 * Storage keys and revivers for the businesses table state.
 *
 * Kept free of React imports so the (defensive) parsing of previously stored values is easy to
 * unit test: entries may have been written by an older version of the app, hand-edited, or
 * reference columns that no longer exist.
 */

import type { ColumnVisibilityState, SortingState } from '@tanstack/react-table';

const STORAGE_KEY_PREFIX = 'businesses';

/** Persisted across refreshes (localStorage). */
export const BUSINESSES_STORAGE_KEYS = {
  SORTING: `${STORAGE_KEY_PREFIX}_sorting`,
  COLUMN_VISIBILITY: `${STORAGE_KEY_PREFIX}_columnVisibility`,
} as const;

/** Kept in memory only — selection survives navigation, but not a page refresh. */
export const BUSINESSES_ROW_SELECTION_KEY = `${STORAGE_KEY_PREFIX}_rowSelection`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accepts a stored sorting state only when every entry has the `{ id, desc }` shape. Entries
 * pointing at columns that no longer exist are harmless — the sorted row model skips them.
 */
export function reviveSorting(parsed: unknown, fallback: SortingState): SortingState {
  if (!Array.isArray(parsed)) {
    return fallback;
  }
  const isValid = parsed.every(
    entry => isRecord(entry) && typeof entry.id === 'string' && typeof entry.desc === 'boolean',
  );
  return isValid ? (parsed as SortingState) : fallback;
}

/**
 * Merges the stored visibility over the current defaults, so columns added since the value was
 * stored keep their default visibility instead of disappearing.
 */
export function reviveColumnVisibility(
  parsed: unknown,
  fallback: ColumnVisibilityState,
): ColumnVisibilityState {
  if (!isRecord(parsed)) {
    return fallback;
  }
  const stored: ColumnVisibilityState = {};
  for (const [columnId, isVisible] of Object.entries(parsed)) {
    if (typeof isVisible === 'boolean') {
      stored[columnId] = isVisible;
    }
  }
  return { ...fallback, ...stored };
}
