import { z } from 'zod';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type {
  LabeledCounter,
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import {
  GLOSSARY,
  GLOSSARY_TOPICS,
  type GlossaryEntry,
  type GlossaryTopic,
} from './terminology-data.js';

/**
 * Domain-terminology lookup (the connector's glossary).
 *
 * The other tools all return *data*; none of them explain what the data means.
 * That gap is load-bearing here — "charge" is not a bank charge, `byOwners` and
 * `byBusinesses` ask opposite questions, and ledger slot 2 is the VAT split —
 * and it cannot live in per-tool `description` strings, which every caller pays
 * for on every `tools/list` and which cannot carry concepts spanning tools.
 *
 * Two properties make this tool unlike the other eleven:
 *
 * 1. It is **pure**. The handler never touches `context.client`, so there is no
 *    upstream call and no `x-business-scope` header. `scope-forwarding.test.ts`
 *    knows about this via its `PURE_TOOLS` set.
 * 2. It is **unscoped** (`requiresBusinessScope: false`). A caller with zero
 *    memberships must still be able to read the glossary — same reasoning as
 *    `businesses.ts`, and the reason the content carries no customer data and is
 *    classified `public`.
 */

export const EXPLAIN_TERMINOLOGY_TOOL_NAME = 'accounter_explain_terminology';

/** Upper bound on terms per call. Generous — each match is a few hundred bytes. */
export const MAX_REQUESTED_TERMS = 20;

/**
 * Labeled counters this tool contributes to `/metrics`.
 *
 * The glossary's value is a function of what callers actually ask it, so the two
 * questions worth answering cheaply are which terms get looked up and which
 * looked-up terms do not exist yet — the latter being the list of entries the
 * glossary is missing.
 */
export const GLOSSARY_TERM_REQUESTS_COUNTER = 'glossary_term_requests';
export const GLOSSARY_TERM_MISSES_COUNTER = 'glossary_term_misses';
export const GLOSSARY_MODE_COUNTER = 'glossary_mode';

/**
 * Length cap on a miss label.
 *
 * A miss label is caller-supplied text reaching the unauthenticated `/metrics`
 * snapshot, so it is folded (collapsing `Value Date`/`valueDate`/`value-date`
 * into one label) and clipped. The input schema already caps a term at 60 chars;
 * this keeps the label short enough to read in a snapshot.
 */
const MAX_MISS_LABEL_LENGTH = 40;

/** Shortest shared prefix that makes a term worth suggesting for a typo. */
const MIN_SUGGESTION_PREFIX = 3;

/** Suggestions returned alongside an unmatched term. */
const MAX_SUGGESTIONS = 3;

/**
 * Shortest spelling allowed to match as a substring *of the request*.
 *
 * That direction is what tolerates trailing noise (`ledgerrr` -> `ledger-record`),
 * but applied to short aliases it fires on unrelated words — `fee` inside
 * `feedback`, `vat` inside a longer token. Long spellings only.
 */
const MIN_LOOSE_MATCH_LENGTH = 5;

const explainTerminologyInput = z.object({
  terms: z
    .array(z.string().min(2).max(60))
    .min(1)
    .max(MAX_REQUESTED_TERMS)
    .optional()
    .describe(
      'Look up specific terms. Matches the canonical name, any alias (enum tokens like `INTERNAL`, ' +
        'GraphQL type names like `InternalTransferCharge`, field names like `effectiveDate`), then ' +
        'falls back to a substring search. Case, hyphens, underscores and spaces are ignored. ' +
        'A term that matches nothing is reported under `unmatched` with suggestions — it does not fail the call.',
    ),
  topics: z
    .array(z.enum(GLOSSARY_TOPICS))
    .min(1)
    .optional()
    .describe(
      'Return every term in these topics, in full. Topics are `charge`, `transaction`, `document`, ' +
        '`ledger`, `entity` (businesses, tax categories, sort codes) and `scope` (owner vs counterparty, memberships).',
    ),
});

type ExplainTerminologyInput = z.infer<typeof explainTerminologyInput>;

/**
 * Fold a term to its comparison form: lowercase, non-alphanumerics stripped.
 *
 * This is what lets one alias cover several spellings — `value-date`,
 * `valueDate` and `value date` all fold to `valuedate`, and
 * `InternalTransferCharge` folds onto the `internal-transfer-charge` term
 * itself. Unicode-aware so Hebrew aliases survive.
 */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Every folded spelling that should resolve to an entry. */
function spellingsOf(entry: GlossaryEntry): string[] {
  return [entry.term, ...(entry.aliases ?? [])].map(fold);
}

/** Folded spelling -> entry. Built once; the glossary is static. */
const ENTRY_BY_SPELLING = new Map<string, GlossaryEntry>();
for (const entry of GLOSSARY) {
  for (const spelling of spellingsOf(entry)) {
    // First writer wins; `terminology-contract.test.ts` proves there are no
    // collisions, so this is a guard against silent overwrite, not a policy.
    if (!ENTRY_BY_SPELLING.has(spelling)) {
      ENTRY_BY_SPELLING.set(spelling, entry);
    }
  }
}

/**
 * Resolve one requested term. Tried in order so an exact hit always beats a
 * coincidental substring: exact spelling, then substring of a spelling, then
 * substring of the summary text.
 */
function lookup(requested: string): GlossaryEntry | undefined {
  const needle = fold(requested);
  if (needle.length === 0) {
    return undefined;
  }

  const exact = ENTRY_BY_SPELLING.get(needle);
  if (exact) {
    return exact;
  }

  const bySpelling = GLOSSARY.find(entry =>
    spellingsOf(entry).some(
      spelling =>
        spelling.includes(needle) ||
        (spelling.length >= MIN_LOOSE_MATCH_LENGTH && needle.includes(spelling)),
    ),
  );
  if (bySpelling) {
    return bySpelling;
  }

  return GLOSSARY.find(entry => fold(entry.summary).includes(needle));
}

/** Terms sharing a leading prefix with an unmatched request, for a "did you mean". */
function suggestionsFor(requested: string): string[] {
  const needle = fold(requested);
  const prefix = needle.slice(0, MIN_SUGGESTION_PREFIX);
  if (prefix.length < MIN_SUGGESTION_PREFIX) {
    return [];
  }
  return GLOSSARY.filter(entry => spellingsOf(entry).some(spelling => spelling.startsWith(prefix)))
    .slice(0, MAX_SUGGESTIONS)
    .map(entry => entry.term);
}

interface IndexItem {
  term: string;
  topic: GlossaryTopic;
  summary: string;
}

interface FullItem extends IndexItem {
  detail: string;
  aliases?: readonly string[];
  seeAlso?: readonly string[];
  tools?: readonly string[];
}

function toIndexItem(entry: GlossaryEntry): IndexItem {
  return { term: entry.term, topic: entry.topic, summary: entry.summary };
}

function toFullItem(entry: GlossaryEntry): FullItem {
  const item: FullItem = { ...toIndexItem(entry), detail: entry.detail };
  if (entry.aliases) item.aliases = entry.aliases;
  if (entry.seeAlso) item.seeAlso = entry.seeAlso;
  if (entry.tools) item.tools = entry.tools;
  return item;
}

interface UnmatchedTerm {
  term: string;
  suggestions: string[];
}

/**
 * Select the entries to return, preserving glossary (topic) order regardless of
 * the order the caller asked in, and de-duplicating when `terms` and `topics`
 * both name the same entry.
 */
function selectEntries(input: ExplainTerminologyInput): {
  entries: GlossaryEntry[];
  unmatched: UnmatchedTerm[];
} {
  const selected = new Set<GlossaryEntry>();
  const unmatched: UnmatchedTerm[] = [];

  for (const requested of input.terms ?? []) {
    const entry = lookup(requested);
    if (entry) {
      selected.add(entry);
    } else {
      unmatched.push({ term: requested, suggestions: suggestionsFor(requested) });
    }
  }

  if (input.topics) {
    const wanted = new Set<GlossaryTopic>(input.topics);
    for (const entry of GLOSSARY) {
      if (wanted.has(entry.topic)) {
        selected.add(entry);
      }
    }
  }

  return { entries: GLOSSARY.filter(entry => selected.has(entry)), unmatched };
}

function handler(input: ExplainTerminologyInput, _context: ToolExecutionContext): ToolResult {
  // Mode is derived rather than a flag: asking for nothing in particular means
  // "show me what exists" (cheap), asking for something means "explain it".
  if (isIndexMode(input)) {
    return shapeListResult({
      items: GLOSSARY.map(toIndexItem),
      itemsKey: 'terms',
      extra: { mode: 'index', topics: GLOSSARY_TOPICS },
      summarize: (shown, total, truncated) =>
        `Accounter glossary index: ${shown} of ${total} term(s)${truncated ? ' (truncated)' : ''}. ` +
        'Call again with `terms` or `topics` for full definitions.',
    });
  }

  const { entries, unmatched } = selectEntries(input);

  return shapeListResult({
    items: entries.map(toFullItem),
    itemsKey: 'terms',
    extra: { mode: 'full', unmatched },
    summarize: (shown, total, truncated) => {
      const found =
        total === 0
          ? 'No matching glossary terms.'
          : `Returning ${shown} of ${total} glossary term(s)${truncated ? ' (truncated)' : ''}.`;
      if (unmatched.length === 0) {
        return found;
      }
      const detail = unmatched
        .map(item =>
          item.suggestions.length > 0
            ? `${item.term} (did you mean: ${item.suggestions.join(', ')})`
            : item.term,
        )
        .join('; ');
      return `${found} Not found: ${detail}.`;
    },
  });
}

/** Index mode is "show me what exists"; full mode is "explain this". */
function isIndexMode(input: ExplainTerminologyInput): boolean {
  return input.terms === undefined && input.topics === undefined;
}

/**
 * Usage telemetry for a finished lookup.
 *
 * Matches are resolved from `input.terms` rather than read back off the result,
 * which looks like duplicated work but is the only correct source. A call
 * carrying `topics` returns every entry in those topics, and none of those
 * entries were individually asked for — counting them would make
 * "most-requested term" a measure of topic breadth instead of caller interest.
 * Re-resolving is a `Map` hit per term, at most {@link MAX_REQUESTED_TERMS} of
 * them.
 *
 * Both spellings are reported: `requestedTerms` verbatim (so an alias the caller
 * reached for, `valueDate`, stays visible) alongside the canonical `matchedTerms`
 * it resolved to.
 */
function observe(input: ExplainTerminologyInput, _result: ToolResult): ToolObservation {
  if (isIndexMode(input)) {
    // No per-term counters here on purpose: index mode returns all of the
    // glossary, and crediting every entry would bury the real signal.
    return {
      fields: { glossaryMode: 'index', requestedTermCount: 0 },
      counters: [[GLOSSARY_MODE_COUNTER, 'index']],
    };
  }

  const requestedTerms = input.terms ?? [];
  const matchedTerms: string[] = [];
  const missedTerms: string[] = [];
  for (const requested of requestedTerms) {
    const entry = lookup(requested);
    if (entry) {
      matchedTerms.push(entry.term);
    } else {
      missedTerms.push(requested);
    }
  }

  const counters: LabeledCounter[] = [[GLOSSARY_MODE_COUNTER, 'full']];
  for (const term of matchedTerms) {
    counters.push([GLOSSARY_TERM_REQUESTS_COUNTER, term]);
  }
  for (const term of missedTerms) {
    counters.push([GLOSSARY_TERM_MISSES_COUNTER, missLabel(term)]);
  }

  return {
    fields: {
      glossaryMode: 'full',
      requestedTermCount: requestedTerms.length,
      requestedTerms,
      matchedTerms,
      missedTerms,
      requestedTopics: input.topics ?? [],
    },
    counters,
  };
}

/** Fold and clip an unmatched term into a metrics-safe label. */
function missLabel(term: string): string {
  return fold(term).slice(0, MAX_MISS_LABEL_LENGTH);
}

export const explainTerminologyTool: ToolDefinition<typeof explainTerminologyInput> = {
  name: EXPLAIN_TERMINOLOGY_TOOL_NAME,
  description:
    'Explain Accounter domain terminology — what charges, transactions, documents, ledger records, ' +
    'businesses and tax categories actually mean in this system, including the distinctions that are ' +
    'not inferable from the schema (a "charge" is an aggregate grouping transactions + documents + ' +
    'ledger records, not a bank charge; `byOwners` selects your business while `byBusinesses` selects ' +
    'the counterparty; `INTERNAL`/`CONVERSION` charges are money moving between your own accounts and ' +
    'double-count in spend totals). Call it with no arguments for a one-line index of every term, then ' +
    'pass `terms` to define specific ones or `topics` to read a whole area. Reference content only: ' +
    'static, read-only, no business data, and callable before you know which businesses you can access. ' +
    resultEnvelopeDescription('terms'),
  inputSchema: explainTerminologyInput,
  policy: {
    // Deliberately unscoped and `public`: the content is static reference text
    // with no customer data, and a caller with zero memberships must still be
    // able to read it (cf. `listBusinessMembershipsTool`).
    requiresBusinessScope: false,
    dataClassification: 'public',
  },
  handler,
  observe,
};
