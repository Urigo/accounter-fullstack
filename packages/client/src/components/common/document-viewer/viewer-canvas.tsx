import { useCallback, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils.js';
import { AccounterSpinner } from '../../ui/accounter-spinner.js';
import { Magnifier, type MagnifierHandle } from './magnifier.js';
import type { LoupeSize } from './types.js';
import { useViewerGestures } from './use-viewer-gestures.js';
import type { ViewerZoom } from './use-viewer-zoom.js';
import { displaySize } from './viewer-geometry.js';

export interface ViewerCanvasProps {
  viewer: ViewerZoom;
  src: string;
  title: string;
  magnifierOn: boolean;
  loupeSize: LoupeSize;
  /** Shown in place of the page when the image fails to load. */
  errorFallback: ReactNode;
}

/**
 * The scrolling canvas: a scroll box, a content wrapper, a page box, then the image.
 *
 * The page box is the image's *rotated* bounding box at the current zoom, because a CSS transform
 * alone does not change scroll extents; the image is centred inside it and transformed. The content
 * wrapper is `w-max min-w-full` with an `mx-auto` page box rather than `justify-center`, which
 * would clip the left edge once the page is wider than the pane.
 */
export function ViewerCanvas({
  viewer,
  src,
  title,
  magnifierOn,
  loupeSize,
  errorFallback,
}: ViewerCanvasProps): ReactElement {
  const { state, scrollRef, pageRef, imageRef } = viewer;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const magnifierRef = useRef<MagnifierHandle | null>(null);
  const panningRef = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const ready = state.status === 'ready';
  const showLoupe = magnifierOn && ready && !!state.natural;

  const onPanChange = useCallback((next: boolean): void => {
    panningRef.current = next;
    setPanning(next);
    if (next) {
      magnifierRef.current?.hide();
    }
  }, []);

  useViewerGestures(scrollRef, ready, {
    zoomByFactor: viewer.zoomByFactor,
    toggleAt: viewer.toggleAt,
    onPanChange,
  });

  const display = state.natural ? displaySize(state.natural, state.zoom, 0) : null;

  return (
    <div ref={containerRef} data-status={state.status} className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        role="group"
        aria-label="Document image"
        // The canvas must be reachable by keyboard so arrow keys can scroll it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={cn(
          'absolute inset-0 touch-none overflow-auto overscroll-contain bg-gray-100 outline-none select-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-inset dark:bg-gray-900',
          ready && state.scrollable && (panning ? 'cursor-grabbing' : 'cursor-grab'),
        )}
        onPointerMove={e => {
          if (!showLoupe || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) {
            return;
          }
          lastPointer.current = { x: e.clientX, y: e.clientY };
          if (!panningRef.current) {
            magnifierRef.current?.move(e.clientX, e.clientY);
          }
        }}
        onPointerLeave={() => {
          lastPointer.current = null;
          magnifierRef.current?.hide();
        }}
        onScroll={() => {
          const point = lastPointer.current;
          if (showLoupe && point && !panningRef.current) {
            magnifierRef.current?.move(point.x, point.y);
          }
        }}
      >
        {state.status === 'error' ? (
          <div className="flex min-h-full items-center justify-center p-4">{errorFallback}</div>
        ) : (
          <div className="w-max min-w-full p-2">
            <div
              ref={pageRef}
              className={cn(
                'relative mx-auto bg-white shadow-sm ring-1 ring-black/10',
                state.status !== 'ready' && state.status !== 'unsized' && 'invisible',
              )}
              style={display ? { width: display.width, height: display.height } : undefined}
            >
              <img
                ref={imageRef}
                src={src}
                alt={title}
                draggable={false}
                decoding="async"
                onDragStart={e => e.preventDefault()}
                onLoad={viewer.onImageLoad}
                onError={viewer.onImageError}
                className={
                  state.status === 'unsized'
                    ? 'block h-auto w-full'
                    : 'absolute top-1/2 left-1/2 max-w-none'
                }
                style={
                  state.natural && state.status === 'ready'
                    ? {
                        width: state.natural.width * state.zoom,
                        height: state.natural.height * state.zoom,
                        transform: 'translate(-50%, -50%) rotate(0deg)',
                      }
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </div>

      {state.status === 'loading' && (
        <div
          data-slot="document-viewer-spinner"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-500"
        >
          <AccounterSpinner className="size-16" />
        </div>
      )}

      {showLoupe && state.natural && (
        <Magnifier
          ref={magnifierRef}
          src={src}
          natural={state.natural}
          zoom={state.zoom}
          rotation={0}
          size={loupeSize}
          pageRef={pageRef}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}
