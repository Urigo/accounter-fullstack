import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const indicatorDotVariants = cva(
  'pointer-events-none absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 rounded-full',
  {
    variants: {
      color: {
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500',
        blue: 'bg-blue-500',
      },
      // Mantine's `processing` ripples the dot outward. `animate-pulse` is the calmer
      // Tailwind equivalent — same "something is still resolving" read, one element.
      processing: {
        true: 'animate-pulse',
        false: '',
      },
    },
    defaultVariants: {
      color: 'red',
      processing: false,
    },
  },
);

type IndicatorProps = React.ComponentProps<'div'> &
  VariantProps<typeof indicatorDotVariants> & {
    /** Lay the wrapper out inline rather than as a block. */
    inline?: boolean;
    /** Dot diameter in pixels. Dynamic, so it is applied as a style rather than a class. */
    size?: number;
    /** Hide the dot. Named for parity with the call sites, which all read `disabled={!isError}`. */
    disabled?: boolean;
    zIndex?: React.CSSProperties['zIndex'];
  };

/**
 * Wraps content with a small status dot in its top-right corner — a "this row has an
 * error" / "this filter is active" marker.
 *
 * There is no shadcn equivalent, so this is a first-class local primitive rather than a
 * compatibility shim, and it is what replaced Mantine's `Indicator` across the client.
 */
function Indicator({
  className,
  children,
  inline = false,
  size = 10,
  disabled = false,
  color,
  processing,
  zIndex,
  ...props
}: IndicatorProps) {
  return (
    <div
      data-slot="indicator"
      className={cn('relative', inline ? 'inline-block' : 'block', className)}
      {...props}
    >
      {children}
      {!disabled && (
        <span
          data-slot="indicator-dot"
          className={cn(indicatorDotVariants({ color, processing }))}
          style={{ width: size, height: size, zIndex }}
        />
      )}
    </div>
  );
}

export { Indicator, indicatorDotVariants };
