import type { ReactElement } from 'react';
import { cn } from '../../lib/utils.js';

export interface SimpleGridProps {
  cols: number;
  className?: string;
  children?: ReactElement | ReactElement[];
}

/**
 * Responsive grid stepping up to `cols` on wide viewports.
 *
 * Replaces Mantine's `SimpleGrid`, whose v6 `breakpoints` array was max-width based
 * (desktop-first) while Tailwind's variants are min-width based, so the ladder below is the
 * inverted equivalent: one column on phones, two on small screens, then up to `cols`. The
 * original config listed both `maxWidth: 900, cols: 2` and `maxWidth: 755, cols: 2` — the
 * latter was unreachable, so these boundaries were never precision-tuned.
 *
 * Classes are spelled out per column count rather than interpolated because Tailwind only
 * emits utilities it can find as literals in the source.
 */
const columnClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
};

export const SimpleGrid = ({ cols, className, children }: SimpleGridProps): ReactElement => {
  return (
    <div className={cn('grid gap-3 sm:gap-4', columnClasses[cols] ?? columnClasses[1], className)}>
      {children}
    </div>
  );
};
