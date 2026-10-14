import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { FitMode, Point, Rotation, Size, ZoomMode } from './types.js';
import {
  clampScroll,
  clampZoom,
  displaySize,
  doubleClickTarget,
  fitZoom,
  innerViewport,
  stepZoom,
  zoomAt,
  zoomBounds,
} from './viewer-geometry.js';

/** The canvas content wrapper's `p-2`, in pixels. */
export const CANVAS_PADDING = 8;

/**
 * - `loading`: the image has not reported its size yet.
 * - `ready`: the size is known and every zoom control works.
 * - `unsized`: it loaded with a natural width of 0 (some SVGs), so it is shown at the pane width
 *   with zoom disabled.
 * - `error`: it failed to load.
 */
export type ViewerStatus = 'loading' | 'ready' | 'unsized' | 'error';

export interface ViewerZoomState {
  status: ViewerStatus;
  natural: Size | null;
  zoom: number;
  mode: ZoomMode;
  /** Whether the page is larger than the pane on either axis, i.e. dragging would pan. */
  scrollable: boolean;
}

export interface ViewerZoom {
  state: ViewerZoomState;
  scrollRef: RefObject<HTMLDivElement | null>;
  pageRef: RefObject<HTMLDivElement | null>;
  imageRef: RefObject<HTMLImageElement | null>;
  setFitMode(mode: FitMode): void;
  zoomIn(): void;
  zoomOut(): void;
  /** An explicit zoom (1 = 100%), clamped, anchored at the pane centre. */
  setZoom(zoom: number): void;
  /** Multiply the zoom, keeping the content under a client-coordinate point fixed. */
  zoomByFactor(factor: number, client: Point): void;
  /** Double-click / double-tap: toggle between the current fit and 200% at a client point. */
  toggleAt(client: Point): void;
  onImageLoad(): void;
  onImageError(): void;
}

type Model = {
  natural: Size | null;
  zoom: number;
  mode: ZoomMode;
  lastFit: FitMode;
  rotation: Rotation;
};

const INITIAL_MODE: FitMode = 'width';

/**
 * The zoom model shared by the toolbar and the canvas.
 *
 * Zoom is applied imperatively first: the page and image sizes are written through refs and the
 * scroll position is set straight away, then the result is mirrored into React state for the
 * readout. That keeps the cursor anchor exact when several wheel events arrive before React
 * commits. Model values live in refs and are only read in handlers and effects.
 */
export function useViewerZoom(): ViewerZoom {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const model = useRef<Model>({
    natural: null,
    zoom: 1,
    mode: INITIAL_MODE,
    lastFit: INITIAL_MODE,
    // Rotate arrives in a later step; the geometry already accounts for it.
    rotation: 0,
  });
  const [state, setState] = useState<ViewerZoomState>({
    status: 'loading',
    natural: null,
    zoom: 1,
    mode: INITIAL_MODE,
    scrollable: false,
  });

  const applyZoom = useCallback(
    (requested: number, mode: ZoomMode, anchor?: Point, resetScroll = false): void => {
      const el = scrollRef.current;
      const m = model.current;
      if (!el || !m.natural) {
        return;
      }
      const viewport = { width: el.clientWidth, height: el.clientHeight };
      const bounds = zoomBounds(m.natural, innerViewport(viewport, CANVAS_PADDING), m.rotation);
      const zoom = clampZoom(requested, bounds);
      const display = displaySize(m.natural, zoom, m.rotation);
      const scroll = resetScroll
        ? { x: 0, y: 0 }
        : zoomAt({
            natural: m.natural,
            rotation: m.rotation,
            viewport,
            padding: CANVAS_PADDING,
            zoom: m.zoom,
            nextZoom: zoom,
            scroll: { x: el.scrollLeft, y: el.scrollTop },
            anchor: anchor ?? { x: viewport.width / 2, y: viewport.height / 2 },
          });

      const page = pageRef.current;
      if (page) {
        page.style.width = `${display.width}px`;
        page.style.height = `${display.height}px`;
      }
      const image = imageRef.current;
      if (image) {
        image.style.width = `${m.natural.width * zoom}px`;
        image.style.height = `${m.natural.height * zoom}px`;
      }
      el.scrollLeft = scroll.x;
      el.scrollTop = scroll.y;

      m.zoom = zoom;
      m.mode = mode;
      if (mode !== 'custom') {
        m.lastFit = mode;
      }
      const scrollable = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      setState(s =>
        s.zoom === zoom && s.mode === mode && s.scrollable === scrollable
          ? s
          : { ...s, zoom, mode, scrollable },
      );
    },
    [],
  );

  const resolveFit = useCallback((mode: FitMode): number | null => {
    const el = scrollRef.current;
    const m = model.current;
    if (!el || !m.natural) {
      return null;
    }
    const viewport = innerViewport(
      { width: el.clientWidth, height: el.clientHeight },
      CANVAS_PADDING,
    );
    return fitZoom(mode, m.natural, viewport, m.rotation);
  }, []);

  const setFitMode = useCallback(
    (mode: FitMode): void => {
      const zoom = resolveFit(mode);
      if (zoom != null) {
        applyZoom(zoom, mode, { x: 0, y: 0 });
      }
    },
    [applyZoom, resolveFit],
  );

  const zoomBy = useCallback(
    (dir: 1 | -1): void => {
      const el = scrollRef.current;
      const m = model.current;
      if (!el || !m.natural) {
        return;
      }
      const bounds = zoomBounds(
        m.natural,
        innerViewport({ width: el.clientWidth, height: el.clientHeight }, CANVAS_PADDING),
        m.rotation,
      );
      applyZoom(stepZoom(m.zoom, dir, bounds), 'custom');
    },
    [applyZoom],
  );

  const zoomIn = useCallback((): void => zoomBy(1), [zoomBy]);
  const zoomOut = useCallback((): void => zoomBy(-1), [zoomBy]);

  const setZoom = useCallback((zoom: number): void => applyZoom(zoom, 'custom'), [applyZoom]);

  const toLocal = useCallback((client: Point): Point | undefined => {
    const el = scrollRef.current;
    if (!el) {
      return undefined;
    }
    const rect = el.getBoundingClientRect();
    return { x: client.x - rect.left, y: client.y - rect.top };
  }, []);

  const zoomByFactor = useCallback(
    (factor: number, client: Point): void => {
      if (!Number.isFinite(factor) || factor <= 0 || factor === 1) {
        return;
      }
      applyZoom(model.current.zoom * factor, 'custom', toLocal(client));
    },
    [applyZoom, toLocal],
  );

  const toggleAt = useCallback(
    (client: Point): void => {
      const m = model.current;
      const fit = resolveFit(m.lastFit);
      if (fit == null) {
        return;
      }
      const target = doubleClickTarget({ mode: m.mode, lastFit: m.lastFit }, fit);
      applyZoom(target.zoom, target.mode, toLocal(client));
    },
    [applyZoom, resolveFit, toLocal],
  );

  const onImageLoad = useCallback((): void => {
    const image = imageRef.current;
    const m = model.current;
    if (!image || m.natural) {
      return;
    }
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      setState(s => ({ ...s, status: 'unsized' }));
      return;
    }
    const natural = { width: image.naturalWidth, height: image.naturalHeight };
    m.natural = natural;
    setState(s => ({ ...s, status: 'ready', natural }));
    const zoom = resolveFit(m.lastFit);
    if (zoom != null) {
      applyZoom(zoom, m.lastFit, undefined, true);
    }
  }, [applyZoom, resolveFit]);

  const onImageError = useCallback((): void => {
    setState(s => (s.status === 'loading' ? { ...s, status: 'error' } : s));
  }, []);

  // A cached image can finish loading before React attaches `onLoad`.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      onImageLoad();
    }
  }, [onImageLoad]);

  // Re-apply the fit mode when the pane resizes; a custom zoom only re-clamps the scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const m = model.current;
        // A hidden viewer (`display: none`, kept mounted to keep its state) has no size; fitting or
        // clamping against 0×0 would throw the zoom and scroll away. It resizes again when shown.
        if (!m.natural || el.clientWidth === 0 || el.clientHeight === 0) {
          return;
        }
        if (m.mode === 'custom') {
          const viewport = { width: el.clientWidth, height: el.clientHeight };
          const scroll = clampScroll(
            { x: el.scrollLeft, y: el.scrollTop },
            displaySize(m.natural, m.zoom, m.rotation),
            viewport,
            CANVAS_PADDING,
          );
          el.scrollLeft = scroll.x;
          el.scrollTop = scroll.y;
          return;
        }
        const zoom = resolveFit(m.mode);
        if (zoom != null) {
          applyZoom(zoom, m.mode, { x: 0, y: 0 });
        }
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [applyZoom, resolveFit]);

  return {
    state,
    scrollRef,
    pageRef,
    imageRef,
    setFitMode,
    zoomIn,
    zoomOut,
    setZoom,
    zoomByFactor,
    toggleAt,
    onImageLoad,
    onImageError,
  };
}
