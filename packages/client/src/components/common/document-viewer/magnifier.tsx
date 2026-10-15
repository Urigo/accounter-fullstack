import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type Ref,
  type RefObject,
} from 'react';
import { cn } from '@/lib/utils.js';
import type { LoupeSize, Rotation, Size } from './types.js';
import { displaySize, MAX_ZOOM } from './viewer-geometry.js';

/** How much the loupe magnifies the image as it is currently displayed. */
export const LOUPE_MAGNIFICATION = 2.5;

const LOUPE_PX: Record<LoupeSize, number> = { sm: 160, md: 224, lg: 320 };
const LOUPE_CLASS: Record<LoupeSize, string> = { sm: 'size-40', md: 'size-56', lg: 'size-80' };

export interface MagnifierHandle {
  /** Centre the loupe on a client-coordinate point; hides it when the point is off the page. */
  move(clientX: number, clientY: number): void;
  hide(): void;
}

interface MagnifierProps {
  ref?: Ref<MagnifierHandle>;
  src: string;
  natural: Size;
  zoom: number;
  rotation: Rotation;
  size: LoupeSize;
  /** The canvas page box, measured to find the point under the cursor. */
  pageRef: RefObject<HTMLDivElement | null>;
  /** The positioned element the loupe is absolutely placed in. */
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * The opt-in hover loupe: a square over the viewport holding a second copy of the page box, drawn
 * at 2.5× the displayed zoom and shifted so the cursor point sits in its centre. Scaling the
 * rotated page box means rotation needs no extra math. Pointer moves never touch React state: they
 * are applied through refs once per animation frame.
 */
export function Magnifier({
  ref,
  src,
  natural,
  zoom,
  rotation,
  size,
  pageRef,
  containerRef,
}: MagnifierProps): ReactElement {
  const loupeRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const latest = useRef({ zoom, size });
  useLayoutEffect(() => {
    latest.current = { zoom, size };
  });

  const magnified = Math.min(zoom * LOUPE_MAGNIFICATION, MAX_ZOOM);
  const display = displaySize(natural, magnified, rotation);

  useImperativeHandle(ref, () => {
    const hide = (): void => {
      cancelAnimationFrame(frame.current);
      if (loupeRef.current) {
        loupeRef.current.style.display = 'none';
      }
    };
    const move = (clientX: number, clientY: number): void => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const loupe = loupeRef.current;
        const inner = innerRef.current;
        const page = pageRef.current;
        const container = containerRef.current;
        if (!loupe || !inner || !page || !container) {
          return;
        }
        const pageRect = page.getBoundingClientRect();
        const x = clientX - pageRect.left;
        const y = clientY - pageRect.top;
        if (x < 0 || y < 0 || x > pageRect.width || y > pageRect.height) {
          loupe.style.display = 'none';
          return;
        }
        const { zoom: currentZoom, size: currentSize } = latest.current;
        const side = LOUPE_PX[currentSize];
        const scale = Math.min(currentZoom * LOUPE_MAGNIFICATION, MAX_ZOOM) / currentZoom;
        const containerRect = container.getBoundingClientRect();
        loupe.style.display = 'block';
        loupe.style.transform = `translate(${clientX - containerRect.left - side / 2}px, ${
          clientY - containerRect.top - side / 2
        }px)`;
        inner.style.transform = `translate(${side / 2 - x * scale}px, ${side / 2 - y * scale}px)`;
      });
    };
    return { move, hide };
  }, [pageRef, containerRef]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div
      ref={loupeRef}
      aria-hidden
      data-testid="document-viewer-loupe"
      className={cn(
        'pointer-events-none absolute top-0 left-0 z-10 hidden overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg',
        LOUPE_CLASS[size],
      )}
    >
      <div
        ref={innerRef}
        className="absolute top-0 left-0"
        style={{ width: display.width, height: display.height }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute top-1/2 left-1/2 max-w-none"
          style={{
            width: natural.width * magnified,
            height: natural.height * magnified,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        />
      </div>
    </div>
  );
}
