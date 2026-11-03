import type { ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/button.js';
import { Tooltip } from '../tooltip.js';
import { withShortcut } from './use-viewer-shortcuts.js';

export interface ViewerStepperProps {
  /** Zero-based position of the document shown. */
  index: number;
  total: number;
  onStep(delta: 1 | -1): void;
}

/**
 * `‹ 3/12 ›`: steps through the documents of the table the viewer was opened from, in its order.
 * No wrap-around, so each arrow is disabled at its end.
 *
 * Disabled with `aria-disabled` and a no-op click, not `disabled`: stepping onto the last document
 * with the keyboard would otherwise disable the focused button, dropping focus to the body, where
 * Esc no longer reaches the docked viewer. The position is a polite live region, so each step is
 * announced.
 */
export function ViewerStepper({ index, total, onStep }: ViewerStepperProps): ReactElement {
  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  return (
    <div
      role="group"
      aria-label="Step through documents"
      data-slot="document-viewer-stepper"
      className="flex shrink-0 items-center"
    >
      <Tooltip content={withShortcut('Previous document', 'previous')} asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 aria-disabled:cursor-default aria-disabled:opacity-50"
          aria-label="Previous document"
          aria-disabled={atStart || undefined}
          onClick={() => {
            if (!atStart) {
              onStep(-1);
            }
          }}
        >
          <ChevronLeft className="size-4" />
        </Button>
      </Tooltip>
      <span className="min-w-10 text-center text-sm text-gray-600 tabular-nums dark:text-gray-400">
        <span aria-hidden>
          {index + 1}/{total}
        </span>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Document {index + 1} of {total}
        </span>
      </span>
      <Tooltip content={withShortcut('Next document', 'next')} asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 aria-disabled:cursor-default aria-disabled:opacity-50"
          aria-label="Next document"
          aria-disabled={atEnd || undefined}
          onClick={() => {
            if (!atEnd) {
              onStep(1);
            }
          }}
        >
          <ChevronRight className="size-4" />
        </Button>
      </Tooltip>
    </div>
  );
}
