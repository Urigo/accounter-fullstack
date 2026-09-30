import type { ReactElement, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.js';
import { cn } from '@/lib/utils.js';
import { RowApprovalStatus, type RowApproval } from './approval-status.js';
import { CommentIndicator, type RowComments } from './comment-indicator.js';
import { DiffMarkers, type RowDiff } from './diff-markers.js';
import { formatCurrency } from './utils/types.js';

/**
 * Everything the report's layers say about one row, built once per row by TreePanel. Each layer
 * owns one optional field; a layer with nothing to say about a row leaves its field unset.
 */
export type RowAnnotations = {
  /** How this row differs from the last saved baseline, when a baseline is in play. */
  diff?: RowDiff;
  /**
   * The row's comments. Set on every report row while the comments layer is on (a saved template
   * is loaded), so the slot is reserved on each of them — including rows with nothing to show —
   * and the column never shifts from row to row. Absent, the slot isn't rendered at all.
   */
  comments?: RowComments;
  /** The row's accountant status. Report rows reserve a slot for it even when it is absent. */
  approval?: RowApproval;
};

interface RowTrailingProps {
  annotations: RowAnnotations;
  /** The row's amount: a leaf's own value, or a branch's total. */
  value: number;
  /** Explains the amount on hover. Without it the badge has no tooltip. */
  valueTooltip?: string;
  /**
   * Report rows reserve fixed-width slots so each layer's marker lines up as a column, even on rows
   * without one. Bank rows have no slots.
   */
  withSlots: boolean;
  /** The row's own controls, shown between the amount and the slots. */
  children?: ReactNode;
}

/**
 * The right-hand end of a tree row, shared by branch and leaf rows: diff markers, the amount, the
 * row's controls, then one fixed-width slot per layer: comments, then the approval status.
 */
export function RowTrailing({
  annotations,
  value,
  valueTooltip,
  withSlots,
  children,
}: RowTrailingProps): ReactElement {
  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        'text-xs font-mono',
        value >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
      )}
    >
      {formatCurrency(value)}
    </Badge>
  );

  return (
    <div className="flex items-center gap-2 ml-auto">
      <DiffMarkers diff={annotations.diff} />

      {valueTooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>{valueTooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        badge
      )}

      {children}

      {withSlots && annotations.comments && (
        <div className="w-7 shrink-0 flex items-center justify-center" data-row-slot="comments">
          <CommentIndicator comments={annotations.comments} />
        </div>
      )}

      {withSlots && (
        <div className="w-7 shrink-0 flex items-center justify-center" data-row-slot="approval">
          {annotations.approval && <RowApprovalStatus approval={annotations.approval} />}
        </div>
      )}
    </div>
  );
}
