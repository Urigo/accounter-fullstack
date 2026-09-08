import React from 'react';
import { cn } from '@/lib/utils.js';
import { Spinner } from './spinner.js';

type OverlayProps = React.ComponentProps<'div'> & {
  /** Backdrop blur radius in pixels. Dynamic, so applied as a style rather than a class. */
  blur?: number;
  /** Centre the children within the overlay. */
  center?: boolean;
};

/**
 * A scrim filling its nearest positioned ancestor. Used to veil a form or table while a
 * mutation is in flight.
 *
 * No shadcn equivalent exists, so this is a first-class local primitive. It replaced
 * Mantine's `Overlay`, whose default appearance was a 60% white wash — matched here so
 * the migration was not also a visual change.
 */
function Overlay({ className, children, blur, center = false, style, ...props }: OverlayProps) {
  return (
    <div
      data-slot="overlay"
      className={cn(
        'absolute inset-0 bg-white/60',
        center && 'flex items-center justify-center',
        className,
      )}
      style={{ backdropFilter: blur ? `blur(${blur}px)` : undefined, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

type LoadingOverlayProps = Omit<OverlayProps, 'center'> & {
  /** Render nothing when false. */
  visible?: boolean;
};

/** An `Overlay` with a centred spinner, shown while `visible`. */
function LoadingOverlay({ visible = false, blur = 1, ...props }: LoadingOverlayProps) {
  if (!visible) {
    return null;
  }
  return (
    <Overlay center blur={blur} {...props}>
      <Spinner className="size-8 text-gray-500" />
    </Overlay>
  );
}

export { Overlay, LoadingOverlay };
