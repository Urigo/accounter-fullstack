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
 * inverted equivalent. The thresholds are Mantine's own (≤600 → 1, 601–900 → 2, 901–980 → 3,
 * >980 → `cols`) rather than Tailwind's sm/lg/xl, so this migration does not also move the
 * layout — hence the arbitrary `min-[…]` variants in place of the usual core utilities.
 *
 * One deliberate difference: Mantine applied those breakpoints regardless of `cols`, so a
 * `cols={1}` grid still rendered 3 columns between 901px and 980px. Each tier is capped at
 * `cols` here, which is plainly what the call sites intend.
 *
 * Classes are spelled out per column count rather than interpolated because Tailwind only
 * emits utilities it can find as literals in the source.
 */
const columnClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 min-[601px]:grid-cols-2',
  3: 'grid-cols-1 min-[601px]:grid-cols-2 min-[901px]:grid-cols-3',
  4: 'grid-cols-1 min-[601px]:grid-cols-2 min-[901px]:grid-cols-3 min-[981px]:grid-cols-4',
  5: 'grid-cols-1 min-[601px]:grid-cols-2 min-[901px]:grid-cols-3 min-[981px]:grid-cols-5',
};

export const SimpleGrid = ({ cols, className, children }: SimpleGridProps): ReactElement => {
  return (
    <div
      className={cn(
        'grid gap-3 min-[901px]:gap-4',
        columnClasses[cols] ?? columnClasses[1],
        className,
      )}
    >
      {children}
    </div>
  );
};
