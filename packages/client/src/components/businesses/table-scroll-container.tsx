import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/utils.js';

interface TableScrollContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a horizontally-scrollable table (the shadcn `Table` renders its own
 * `[data-slot="table-container"]` scroller) and fades in edge shadows while more content is hidden
 * to the left/right, hinting that the area scrolls. Scroll events don't bubble, so we listen in the
 * capture phase; a ResizeObserver keeps the shadows in sync when columns toggle or the viewport
 * resizes.
 */
export function TableScrollContainer({
  children,
  className,
}: TableScrollContainerProps): ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [shadows, setShadows] = useState({ left: false, right: false });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const scroller = wrapper.querySelector<HTMLElement>('[data-slot="table-container"]');
    if (!scroller) {
      return;
    }

    const update = (): void => {
      const { scrollLeft, scrollWidth, clientWidth } = scroller;
      setShadows({
        left: scrollLeft > 0,
        right: Math.ceil(scrollLeft + clientWidth) < scrollWidth,
      });
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) {
      observer.observe(scroller.firstElementChild);
    }
    return () => {
      scroller.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {children}
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/15 to-transparent transition-opacity dark:from-black/40',
          shadows.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/15 to-transparent transition-opacity dark:from-black/40',
          shadows.right ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
