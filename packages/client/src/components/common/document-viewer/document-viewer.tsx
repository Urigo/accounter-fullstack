import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from 'react';
import {
  ExternalLink,
  FileQuestionMark,
  Maximize2,
  Minimize2,
  PanelRightClose,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { KeyboardRank } from '@/hooks/use-document-viewer.js';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import { cn } from '@/lib/utils.js';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert.js';
import { Button } from '../../ui/button.js';
import { Tooltip } from '../tooltip.js';
import { isSafeHttpUrl } from './source.js';
import type { DocumentViewerSource, FitMode, LoupeSize } from './types.js';
import { useViewerShortcuts } from './use-viewer-shortcuts.js';
import { useViewerZoom } from './use-viewer-zoom.js';
import { ViewerCanvas } from './viewer-canvas.js';
import { ViewerStepper } from './viewer-stepper.js';
import { ViewerToolbar } from './viewer-toolbar.js';

/** The `‹ 3/12 ›` stepper's position and action; see `ViewerStepper`. */
export interface DocumentViewerStepper {
  /** Zero-based position of the document shown. */
  index: number;
  total: number;
  onStep(delta: 1 | -1): void;
}

export interface DocumentViewerProps {
  source: DocumentViewerSource;
  /** Identifies the document shown. A new key resets the canvas: loading state, zoom and scroll. */
  documentKey: string;
  onClose?: () => void;
  /**
   * How `onClose` presents: `close` (✕) dismisses the viewer, `hide` (⇥) collapses it beside the
   * work it sits in, as in the edit sheet.
   */
  closeVariant?: 'close' | 'hide';
  /**
   * Renders the Expand action, which widens the viewer over the work beside it and back, or opens
   * it full screen. Gets the Expand button, to hand to `open()` as the trigger.
   */
  onToggleExpand?: (trigger: HTMLElement) => void;
  /** Whether the viewer is currently expanded; drives the Expand action's state. */
  expanded?: boolean;
  /**
   * Shows the `‹ 3/12 ›` stepper in the header and binds `[`/`]` to it. The embedded viewer never
   * gets one: stepping there would drop the form's unsaved edits (Save & next steps instead).
   */
  stepper?: DocumentViewerStepper;
  /**
   * Takes part in the keyboard shortcuts with this rank (docked 0, embedded 1, overlay 2); only
   * the topmost viewer listens. Leave it out for no shortcuts.
   */
  keyboardRank?: KeyboardRank | null;
  className?: string;
}

/** What the viewer's shortcuts reach in the keyed body. */
interface ViewerBodyHandle {
  ready(): boolean;
  zoomIn(): void;
  zoomOut(): void;
  setFitMode(mode: FitMode): void;
  rotate(): void;
}

/** How long a zoom level must hold before it is announced to screen readers. */
const ANNOUNCE_DELAY_MS = 400;

function originalHref(source: DocumentViewerSource): string | null {
  const href = source.fileUrl ?? source.imageUrl;
  return isSafeHttpUrl(href) ? href : null;
}

function OpenOriginalButton({
  href,
  variant = 'outline',
  condensed = false,
}: {
  href: string;
  variant?: 'outline' | 'ghost';
  /** Icon only in a narrow viewer (under the `@md` container width); the label stays for AT. */
  condensed?: boolean;
}): ReactElement {
  return (
    <Button variant={variant} size="sm" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLink className="size-4" />
        <span className={cn(condensed && 'sr-only @md:not-sr-only')}>Open original</span>
      </a>
    </Button>
  );
}

function EmptyState({ message, href }: { message: string; href: string | null }): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-gray-100 p-6 text-center text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
      <FileQuestionMark className="size-8 text-gray-400" />
      <p>{message}</p>
      {href && <OpenOriginalButton href={href} />}
    </div>
  );
}

interface ViewerBodyProps {
  ref?: Ref<ViewerBodyHandle>;
  imageUrl: string;
  title: string;
  href: string | null;
  showMagnifier: boolean;
  magnifierOn: boolean;
  onMagnifierChange(on: boolean): void;
  loupeSize: LoupeSize;
  onLoupeSizeChange(size: LoupeSize): void;
}

/** Toolbar and canvas for one image. Keyed by the document, so a swap starts from loading. */
function ViewerBody({
  ref,
  imageUrl,
  title,
  href,
  showMagnifier,
  magnifierOn,
  onMagnifierChange,
  loupeSize,
  onLoupeSizeChange,
}: ViewerBodyProps): ReactElement {
  const viewer = useViewerZoom();
  const { status, zoom, mode } = viewer.state;
  const [announcement, setAnnouncement] = useState('');
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const { zoomIn, zoomOut, setFitMode, rotate } = viewer;
  useImperativeHandle(
    ref,
    () => ({ ready: () => statusRef.current === 'ready', zoomIn, zoomOut, setFitMode, rotate }),
    [zoomIn, zoomOut, setFitMode, rotate],
  );

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }
    const timer = setTimeout(
      () => setAnnouncement(`Zoom ${Math.round(zoom * 100)}%`),
      ANNOUNCE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [status, zoom]);

  return (
    <>
      <ViewerToolbar
        disabled={status !== 'ready'}
        zoom={zoom}
        mode={mode}
        onZoomIn={viewer.zoomIn}
        onZoomOut={viewer.zoomOut}
        onZoomChange={viewer.setZoom}
        onFitModeChange={viewer.setFitMode}
        onRotate={viewer.rotate}
        showMagnifier={showMagnifier}
        magnifierOn={magnifierOn}
        onMagnifierChange={onMagnifierChange}
        loupeSize={loupeSize}
        onLoupeSizeChange={onLoupeSizeChange}
      />
      <ViewerCanvas
        viewer={viewer}
        src={imageUrl}
        title={title}
        magnifierOn={showMagnifier && magnifierOn}
        loupeSize={loupeSize}
        errorFallback={
          <Alert variant="destructive" className="max-w-sm bg-white dark:bg-gray-950">
            <TriangleAlert className="size-4" />
            <AlertTitle>Couldn&apos;t load the document preview</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col items-start gap-2">
              <span>The image may have moved or be temporarily unavailable.</span>
              {href && <OpenOriginalButton href={href} />}
            </AlertDescription>
          </Alert>
        }
      />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

/**
 * A reading surface for a document scan: a header with the document's name and actions, a zoom
 * toolbar, and a canvas that fits, zooms and pans the image without ever clipping it.
 *
 * `data-vaul-no-drag` sits on the root, not only the canvas, so neither a pan nor a drag across the
 * toolbar's controls can start a drag on a surrounding vaul drawer.
 */
export function DocumentViewer({
  source,
  documentKey,
  onClose,
  closeVariant = 'close',
  onToggleExpand,
  expanded = false,
  stepper,
  keyboardRank,
  className,
}: DocumentViewerProps): ReactElement {
  // Above the keyed body, so the magnifier choice survives a document swap. Not persisted.
  const [magnifierOn, setMagnifierOn] = useState(false);
  const [loupeSize, setLoupeSize] = useState<LoupeSize>('md');
  const touchOnly = useMediaQuery('(hover: none)');
  const href = originalHref(source);
  const bodyRef = useRef<ViewerBodyHandle | null>(null);

  /**
   * Runs `action` on the body once its image is ready; `false` (key not handled) otherwise. Only
   * ever called from a keydown handler, never while rendering.
   */
  const withReadyBody = (action: (body: ViewerBodyHandle) => void): boolean => {
    const body = bodyRef.current;
    if (!body?.ready()) {
      return false;
    }
    action(body);
    return true;
  };
  const step = (delta: 1 | -1): boolean => {
    if (!stepper || stepper.index + delta < 0 || stepper.index + delta >= stepper.total) {
      return false;
    }
    stepper.onStep(delta);
    return true;
  };

  useViewerShortcuts(keyboardRank, {
    zoomIn: () => withReadyBody(body => body.zoomIn()),
    zoomOut: () => withReadyBody(body => body.zoomOut()),
    fitWidth: () => withReadyBody(body => body.setFitMode('width')),
    actual: () => withReadyBody(body => body.setFitMode('actual')),
    rotate: () => withReadyBody(body => body.rotate()),
    magnifier: () => !touchOnly && withReadyBody(() => setMagnifierOn(on => !on)),
    previous: () => step(-1),
    next: () => step(1),
  });

  return (
    <div
      data-vaul-no-drag
      data-slot="document-viewer"
      // A size container, so the header and toolbar condense to the viewer's width, not the
      // viewport's: a narrow docked column or edit pane condenses as a phone does.
      className={cn('@container flex h-full min-h-0 flex-col bg-white dark:bg-gray-950', className)}
    >
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <Tooltip content={source.title} asChild>
            <h2 className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">
              {source.title}
            </h2>
          </Tooltip>
          {source.subtitle && (
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{source.subtitle}</p>
          )}
        </div>
        {stepper && (
          <ViewerStepper index={stepper.index} total={stepper.total} onStep={stepper.onStep} />
        )}
        <div className="flex shrink-0 items-center gap-1">
          {onToggleExpand && (
            <Tooltip content={expanded ? 'Restore width' : 'Expand'} asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                data-slot="viewer-expand"
                // The name follows the state and the tooltip (WCAG 2.5.3), so there is no
                // `aria-pressed`: a toggle whose label also changes would announce the state twice.
                aria-label={expanded ? 'Restore document viewer width' : 'Expand document viewer'}
                onClick={event => onToggleExpand(event.currentTarget)}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </Tooltip>
          )}
          {href && <OpenOriginalButton href={href} variant="ghost" condensed />}
          {onClose && (
            <Tooltip content={closeVariant === 'hide' ? 'Hide document' : 'Close'} asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={closeVariant === 'hide' ? 'Hide document' : 'Close document viewer'}
                onClick={onClose}
              >
                {closeVariant === 'hide' ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <X className="size-4" />
                )}
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {source.imageUrl ? (
        <ViewerBody
          ref={bodyRef}
          key={documentKey}
          imageUrl={source.imageUrl}
          title={source.title}
          href={href}
          showMagnifier={!touchOnly}
          magnifierOn={magnifierOn}
          onMagnifierChange={setMagnifierOn}
          loupeSize={loupeSize}
          onLoupeSizeChange={setLoupeSize}
        />
      ) : (
        <EmptyState
          message={source.fileUrl ? 'No preview for this file' : 'No image or file attached'}
          href={href}
        />
      )}
    </div>
  );
}
