import type { ToolResult } from './registry.js';

/**
 * Centralized output shaping and truncation for all tools (spec §9.3).
 *
 * List-producing tools build their result through {@link shapeListResult}. It
 * enforces a maximum serialized payload size by dropping whole trailing items
 * (never cutting a JSON structure mid-object), reports how many items were
 * returned versus available, and attaches a continuation hint whenever the
 * caller is not seeing everything (either an upstream cap or the payload guard).
 */

/** Max serialized size of a tool result's structured content, in bytes. */
export const MAX_TOOL_RESULT_BYTES = 60_000;

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/** Continuation hint returned when results are truncated. */
export interface ContinuationHint {
  reason: 'payload_size' | 'result_cap';
  returnedCount: number;
  totalCount: number;
  hint: string;
}

export interface ShapeListParams<T> {
  /** Items to return (already filtered/normalized; may itself be upstream-capped). */
  items: readonly T[];
  /** Key under which the items are placed in structured content (e.g. `charges`). */
  itemsKey: string;
  /**
   * Total available upstream. Defaults to `items.length`. When greater than the
   * number ultimately returned, the result is marked truncated with a hint.
   */
  total?: number;
  /** Extra domain fields merged into structured content (pagination, period, …). */
  extra?: Record<string, unknown>;
  /** Build the human-readable summary line. */
  summarize?: (shown: number, total: number, truncated: boolean) => string;
  /** Override the byte cap (mainly for tests). */
  maxBytes?: number;
}

function defaultSummary(shown: number, total: number, truncated: boolean): string {
  if (total === 0) {
    return 'No results.';
  }
  return `Returning ${shown} of ${total} result(s)${truncated ? ' (truncated)' : ''}.`;
}

/**
 * Largest prefix length `n` of `items` whose shaped structured content fits
 * within `maxBytes`. Uses binary search so it is deterministic and fast.
 */
function fittingCount(
  build: (n: number) => Record<string, unknown>,
  itemCount: number,
  maxBytes: number,
): number {
  if (byteLength(JSON.stringify(build(itemCount))) <= maxBytes) {
    return itemCount;
  }
  let low = 0;
  let high = itemCount;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (byteLength(JSON.stringify(build(mid))) <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * Shape a list of items into a bounded, valid {@link ToolResult}. Never emits
 * invalid JSON — items are dropped whole from the end when the payload guard
 * trips.
 */
export function shapeListResult<T>(params: ShapeListParams<T>): ToolResult {
  const maxBytes = params.maxBytes ?? MAX_TOOL_RESULT_BYTES;
  // Never let a caller-supplied `total` fall below the number of items on hand;
  // otherwise `totalCount` could be < `returnedCount` and `truncated` would be
  // computed incorrectly.
  const total = Math.max(params.total ?? params.items.length, params.items.length);

  const structuredFor = (shown: number): Record<string, unknown> => {
    const truncated = shown < total;
    // Spread `extra` first so the framework-owned keys below always win a name
    // collision — `extra` can never clobber the items array or the counts.
    const structured: Record<string, unknown> = {
      ...params.extra,
      [params.itemsKey]: params.items.slice(0, shown),
      returnedCount: shown,
      totalCount: total,
      truncated,
    };
    if (truncated) {
      const continuation: ContinuationHint = {
        reason: shown < params.items.length ? 'payload_size' : 'result_cap',
        returnedCount: shown,
        totalCount: total,
        hint: 'Not all results were returned. Narrow your filters or request a smaller/next page to see more.',
      };
      structured.continuation = continuation;
    }
    return structured;
  };

  const shown = fittingCount(structuredFor, params.items.length, maxBytes);
  const structured = structuredFor(shown);
  const truncated = structured.truncated === true;
  const summarize = params.summarize ?? defaultSummary;

  return {
    content: [{ type: 'text', text: summarize(shown, total, truncated) }],
    structuredContent: structured,
  };
}
