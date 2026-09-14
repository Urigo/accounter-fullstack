import React from 'react';
import { cn } from '@/lib/utils.js';

export type ProgressSegment = {
  /**
   * Carries the segment's identity. Not the label, which is not unique — an even split
   * renders the same string in every segment (three of three charges is `33.3% (1)` three
   * times over), which collides as a React key.
   */
  id: string;
  /** Share of the bar, 0-100. */
  value: number;
  /** Background utility for this run, e.g. `bg-green-500`. */
  className?: string;
  /** Rendered inside the run. Omit for an unlabelled bar. */
  label?: React.ReactNode;
};

type SegmentedProgressProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  segments: ProgressSegment[];
};

/**
 * A progress bar divided into several labelled runs.
 *
 * `ui/progress.tsx` cannot express this and is not the thing to reach for: it is Radix's
 * `Progress`, which has one `Indicator` positioned by `translateX` from the left edge and one
 * numeric `value` behind a single `aria-valuenow`. There is no way to place a second run after
 * the first, and one `role="progressbar"` does not describe three proportions anyway.
 *
 * Replaced Mantine's `Progress` in its `sections` form, and keeps its sizing: `size="xl"` was
 * 16px tall and `radius="xl"` fully rounded. Each segment's own colour stays at the call site,
 * since the palette is the caller's meaning (approved/pending/unapproved, say) and not this
 * component's.
 */
function SegmentedProgress({ segments, className, ...props }: SegmentedProgressProps) {
  return (
    <div
      data-slot="segmented-progress"
      className={cn(
        'flex h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800',
        className,
      )}
      {...props}
    >
      {segments.map(segment => (
        <div
          key={segment.id}
          data-slot="segmented-progress-segment"
          style={{ width: `${segment.value}%` }}
          className={cn(
            'flex items-center justify-center overflow-hidden text-[10px] font-bold whitespace-nowrap text-white',
            segment.className,
          )}
        >
          {segment.label}
        </div>
      ))}
    </div>
  );
}

export { SegmentedProgress };
