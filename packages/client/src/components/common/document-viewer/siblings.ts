import { useEffect, useMemo } from 'react';
import { useDocumentViewer } from '@/hooks/use-document-viewer.js';
import type { AnyTable } from '@/lib/table-features.js';
import type { DocumentViewerStepper } from './document-viewer.js';
import { hasViewerAttachment, toDocumentViewerEntry } from './source.js';
import type { DocumentViewerEntry } from './types.js';

/** What a table row needs to become a viewer entry. */
export type ViewerSiblingRow = { id: string } & Parameters<typeof toDocumentViewerEntry>[0];

/**
 * The rows the table shows right now, in its current sort and filter order: every row of an
 * unpaginated table, the current page of a paginated one.
 */
function visibleRows<TData extends ViewerSiblingRow>(table: AnyTable<TData>): TData[] {
  // `getRowModel` exists on both feature sets; the union just can't pick one signature to call.
  const { rows } = (
    table as AnyTable<TData> & { getRowModel(): { rows: { original: TData }[] } }
  ).getRowModel();
  return rows.map(row => row.original);
}

/**
 * The documents the viewer can step through from this table. Documents with neither an image nor
 * a file are left out, so stepping never lands on an empty viewer.
 */
export function buildViewerSiblings<TData extends ViewerSiblingRow>(
  table: AnyTable<TData>,
): DocumentViewerEntry[] {
  return visibleRows(table).map(toDocumentViewerEntry).filter(hasViewerAttachment);
}

/**
 * Every document id the table shows, in order, for Save & next. Unfiltered, unlike
 * {@link buildViewerSiblings}: editing a document with no image and no file is legitimate.
 */
export function getRowIds<TData extends { id: string }>(table: AnyTable<TData>): string[] {
  return visibleRows(table as AnyTable<TData & ViewerSiblingRow>).map(row => row.id);
}

export interface StepperPosition {
  /** Zero-based. */
  index: number;
  total: number;
}

/**
 * Where `currentId` sits among the siblings, or `null` when there is nothing to step through: no
 * siblings, fewer than two, or a current document that isn't one of them.
 */
export function getStepperPosition(
  siblings: readonly DocumentViewerEntry[] | null,
  currentId: string | null | undefined,
): StepperPosition | null {
  if (!siblings || siblings.length < 2 || !currentId) {
    return null;
  }
  const index = siblings.findIndex(entry => entry.id === currentId);
  return index === -1 ? null : { index, total: siblings.length };
}

/** The image URLs of the siblings either side of the current one. */
export function neighbourImageUrls(
  siblings: readonly DocumentViewerEntry[] | null,
  currentId: string | null | undefined,
): string[] {
  const position = getStepperPosition(siblings, currentId);
  if (!siblings || !position) {
    return [];
  }
  return [siblings[position.index - 1], siblings[position.index + 1]]
    .map(entry => entry?.imageUrl)
    .filter((url): url is string => !!url);
}

/**
 * Warms the browser cache with the previous and next siblings' images, so `]` shows the next scan
 * at once. No other prefetching.
 */
export function usePreloadSiblingImages(
  siblings: readonly DocumentViewerEntry[] | null,
  currentId: string | null | undefined,
): void {
  const urls = neighbourImageUrls(siblings, currentId).join('\n');
  useEffect(() => {
    if (!urls || typeof Image === 'undefined') {
      return;
    }
    for (const url of urls.split('\n')) {
      new Image().src = url;
    }
  }, [urls]);
}

/**
 * The store-connected stepper for the viewer showing `currentId`: its position among the siblings
 * snapshot and `step`, or `undefined` when there is nothing to step through. Also preloads the
 * neighbouring images. `currentId` null (a closed viewer) gives no stepper and preloads nothing.
 */
export function useViewerStepper(
  currentId: string | null | undefined,
): DocumentViewerStepper | undefined {
  const siblings = useDocumentViewer(s => s.siblings);
  const step = useDocumentViewer(s => s.step);
  usePreloadSiblingImages(currentId ? siblings : null, currentId);
  const position = getStepperPosition(siblings, currentId);
  const index = position?.index ?? -1;
  const total = position?.total ?? 0;
  return useMemo(
    () => (index === -1 ? undefined : { index, total, onStep: step }),
    [index, total, step],
  );
}
