import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.js';
import { cn } from '@/lib/utils.js';
import type { NodeChange } from './utils/diff.js';
import { formatCurrency } from './utils/types.js';

export type RowDiff = {
  changes: NodeChange[];
  /** Rolled-up delta for this node's subtree; absent when the change is purely structural. */
  subtreeDelta?: number;
  isGhost?: boolean;
};

function signed(delta: number): string {
  const formatted = formatCurrency(Math.abs(delta));
  return `${delta > 0 ? '+' : '−'}${formatted}`;
}

/** One line of explanation per change, for the row's tooltip. */
function explain(change: NodeChange): string {
  switch (change.kind) {
    case 'value':
      return `Was ${formatCurrency(change.previous)}, now ${formatCurrency(change.previous + change.delta)}`;
    case 'added':
      return 'Added since the last save';
    case 'removed':
      return `Removed since the last save — contributed ${formatCurrency(change.previousValue)}`;
    case 'moved':
      return `Moved from ${change.previousParentText}`;
    case 'renamed':
      return `Was named "${change.previousText}"`;
  }
}

/** The short label a structural change earns beside the value. */
function marker(changes: NodeChange[]): string | null {
  if (changes.some(change => change.kind === 'added')) return 'new';
  if (changes.some(change => change.kind === 'removed')) return 'removed';
  if (changes.some(change => change.kind === 'moved')) return 'moved';
  if (changes.some(change => change.kind === 'renamed')) return 'renamed';
  return null;
}

/**
 * The delta badge and structural marker shown beside a row's value. An added row shows its marker
 * rather than a delta: its whole value is new, so a signed delta would just restate the value.
 */
export function DiffMarkers({ diff }: { diff?: RowDiff }): ReactElement | null {
  if (!diff || diff.changes.length === 0) return null;

  const label = marker(diff.changes);
  const isAdded = diff.changes.some(change => change.kind === 'added');
  const showDelta = diff.subtreeDelta != null && !isAdded && !diff.isGhost;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1">
            {showDelta && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-mono',
                  diff.subtreeDelta! > 0
                    ? 'border-emerald-500 text-emerald-700'
                    : 'border-red-500 text-red-700',
                )}
              >
                {signed(diff.subtreeDelta!)}
              </Badge>
            )}
            {label && (
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                {label}
              </Badge>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-0.5">
            {diff.changes.map(change => (
              <span key={change.kind}>{explain(change)}</span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
