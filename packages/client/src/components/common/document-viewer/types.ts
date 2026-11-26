/** What the viewer shows. Plain values, so any caller can open it without a GraphQL fragment. */
export type DocumentViewerSource = {
  imageUrl: string | null;
  fileUrl: string | null;
  title: string;
  subtitle?: string;
};

export type DocumentViewerEntry = DocumentViewerSource & { id: string };

export type Rotation = 0 | 90 | 180 | 270;

export type FitMode = 'width' | 'page' | 'actual';

/** A fit mode, or `custom` once the user picked an explicit zoom. */
export type ZoomMode = FitMode | 'custom';

/** 160 / 224 / 320 px → `size-40` / `size-56` / `size-80`. */
export type LoupeSize = 'sm' | 'md' | 'lg';

export type Size = { width: number; height: number };

export type Point = { x: number; y: number };
