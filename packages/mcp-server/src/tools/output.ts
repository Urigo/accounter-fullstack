import type { ToolResult } from './registry.js';

/**
 * Centralized output shaping and truncation for all tools (spec §9.3).
 *
 * List-producing tools build their result through {@link shapeListResult}. It
 * enforces a maximum serialized payload size by dropping whole trailing items
 * (never cutting a JSON structure mid-object), reports how many items were
 * returned versus available, and attaches a continuation hint whenever the
 * caller is not seeing everything (either an upstream cap or the payload guard).
 *
 * Write tools use {@link shapeWriteResult} instead: what matters there is what
 * changed, so the outcome fields are always kept and only the optional per-item
 * echo is dropped when the payload guard trips.
 */

/**
 * Describe the shared list envelope, for a tool's description text.
 *
 * Lives next to {@link shapeListResult} deliberately: this is the prose
 * counterpart of the object that function builds, and the two drift the moment
 * they live apart.
 *
 * It exists because the description is the *only* channel that reaches the
 * model. Claude Desktop shows it neither `structuredContent` nor a declared
 * `outputSchema` (see `docs/connector-gaps-and-decisions.md`), so anything the
 * model needs to know about a result has to be written in prose — asked what a
 * tool returned, it could infer that rows existed but not what they were keyed
 * under.
 *
 * Same idiom as `SCOPE_DESCRIPTION_SUFFIX`: one shared clause so the model
 * learns the envelope once instead of a different phrasing per tool.
 */
export function resultEnvelopeDescription(itemsKey: string): string {
  return (
    `Rows come back under \`${itemsKey}\`, alongside \`returnedCount\`, \`totalCount\` and ` +
    '`truncated`; when not everything fit, a `continuation` hint says why and what to narrow.'
  );
}

/**
 * Describe the shared write envelope, for a write tool's description text.
 *
 * The counterpart of {@link resultEnvelopeDescription}, and it matters more:
 * neither write tool documents its result at all today, so a model that has
 * just changed data cannot tell from the description what confirmation to
 * expect — including that `itemsOmitted` means the write *applied* and only the
 * echo was dropped, which reads like a failure if you have not been told.
 */
export function writeResultDescription(itemsKey: string): string {
  return (
    `The result reports \`ok\`, \`action\` and per-item outcomes under \`${itemsKey}\`; if that ` +
    'echo is too large it is replaced by `itemsOmitted`, which means the write applied in full and ' +
    'only the echo was dropped.'
  );
}

/** Max serialized size of a tool result's structured content, in bytes. */
export const MAX_TOOL_RESULT_BYTES = 60_000;

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Build a tool result whose payload is visible to *both* kinds of client.
 *
 * The rows go into a `content` text block — which is what a model actually
 * reads — and stay in `structuredContent` for hosts that consume it directly.
 * MCP 2025-06-18: a tool returning structured content SHOULD also return the
 * serialized JSON in a TextContent block.
 *
 * This is deliberately the single place the mirroring happens. Putting rows in
 * `structuredContent` alone made every tool's data invisible to a client that
 * ignores unschema'd structured content, and a per-tool convention would let
 * exactly that drift back in one tool at a time.
 *
 * The summary leads so the model gets a cheap orientation line before the
 * payload, and so existing `content[0]` expectations keep pointing at it.
 */
export function mirroredResult(summary: string, structured: object): ToolResult {
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: JSON.stringify(structured) },
    ],
    structuredContent: structured,
  };
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

  return mirroredResult(summarize(shown, total, truncated), structured);
}

/**
 * Result-size fields for the usage log, pulled off a shaped result.
 *
 * Every list-producing tool builds its payload with {@link shapeListResult}, so
 * these three keys are a shared shape rather than a per-tool convention — the
 * executor can log how much a call actually returned without any tool opting in.
 * Returns an empty object for a result that is not list-shaped (an error result,
 * or a tool that builds its own structured content).
 */
export function listShapeFields(result: ToolResult): Record<string, unknown> {
  const structured = result.structuredContent;
  if (!structured || typeof structured !== 'object') {
    return {};
  }
  const { returnedCount, totalCount, truncated } = structured as {
    returnedCount?: unknown;
    totalCount?: unknown;
    truncated?: unknown;
  };
  const fields: Record<string, unknown> = {};
  if (typeof returnedCount === 'number') fields.returnedCount = returnedCount;
  if (typeof totalCount === 'number') fields.totalCount = totalCount;
  if (typeof truncated === 'boolean') fields.truncated = truncated;
  return fields;
}

export interface ShapeWriteParams<T> {
  /** What the tool did, e.g. `upload_documents`. Echoed as `action`. */
  action: string;
  /** Human-readable summary line. */
  summary: string;
  /** Outcome fields (counts, ids). Always kept — never dropped by the guard. */
  outcome: Record<string, unknown>;
  /** Optional per-item echo of what changed, dropped whole if too large. */
  items?: { key: string; values: readonly T[] };
  /** Override the byte cap (mainly for tests). */
  maxBytes?: number;
}

/**
 * Shape a completed write into a bounded {@link ToolResult}.
 *
 * The asymmetry with {@link shapeListResult} is deliberate. A truncated *list*
 * is still a useful answer, so it drops trailing items one at a time. A write's
 * outcome — did it apply, to what, how many — is never droppable, so the guard
 * applies only to the optional `items` echo, and it drops that echo **whole**:
 * a half-echoed list of changed records would read as "these are the ones that
 * changed", which would be false. When it is dropped, `itemsOmitted` says so
 * rather than leaving the model to infer it from an absent key.
 */
export function shapeWriteResult<T>(params: ShapeWriteParams<T>): ToolResult {
  const maxBytes = params.maxBytes ?? MAX_TOOL_RESULT_BYTES;
  const base: Record<string, unknown> = {
    ...params.outcome,
    ok: true,
    action: params.action,
  };

  let structured = base;
  if (params.items) {
    const withItems = { ...base, [params.items.key]: params.items.values };
    structured =
      byteLength(JSON.stringify(withItems)) <= maxBytes
        ? withItems
        : {
            ...base,
            itemsOmitted: {
              key: params.items.key,
              count: params.items.values.length,
              reason: 'payload_size',
              hint: 'The write applied in full; only the per-item echo was too large to return.',
            },
          };
  }

  return mirroredResult(params.summary, structured);
}
