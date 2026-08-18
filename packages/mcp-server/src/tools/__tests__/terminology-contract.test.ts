import { describe, expect, it } from 'vitest';
import { ACCOUNTANT_STATUSES, CHARGE_TYPES } from '../charge-filters.js';
import { KNOWN_CHARGE_TYPENAMES } from '../entity-shapes.js';
import { toolRegistry } from '../registry-instance.js';
import { explainTerminologyTool } from '../terminology.js';
import { GLOSSARY, GLOSSARY_TOPICS } from '../terminology-data.js';

/**
 * Drift guards for the glossary.
 *
 * A glossary's failure mode is going stale silently: upstream adds a charge type
 * or renames an enum, the vocabulary keeps answering confidently, and the model
 * is told something false. So the content is pinned to the constants that already
 * exist in this package rather than to hand-copied strings — when the schema
 * moves, `schema-contract.test.ts` fails on the filter and this one fails on the
 * definition.
 */

/** Same folding the tool uses to resolve a spelling. */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

const SPELLINGS = new Map<string, string>();
for (const entry of GLOSSARY) {
  for (const spelling of [entry.term, ...(entry.aliases ?? [])]) {
    SPELLINGS.set(fold(spelling), entry.term);
  }
}

const TERMS = new Set(GLOSSARY.map(entry => entry.term));

function resolves(spelling: string): boolean {
  return SPELLINGS.has(fold(spelling));
}

describe('glossary covers the enum vocabularies the tools advertise', () => {
  it.each(CHARGE_TYPES)('defines charge type %s', chargeType => {
    expect(resolves(chargeType)).toBe(true);
  });

  // A charge type added upstream fails here instead of quietly having no definition.
  it.each(KNOWN_CHARGE_TYPENAMES)('defines charge typename %s', typename => {
    expect(resolves(typename)).toBe(true);
  });

  it.each(ACCOUNTANT_STATUSES)('defines accountant status %s', status => {
    expect(resolves(status)).toBe(true);
  });

  it.each(['DEBIT_ACCOUNT_1', 'DEBIT_ACCOUNT_2', 'CREDIT_ACCOUNT_1', 'CREDIT_ACCOUNT_2'])(
    'defines ledger account slot %s',
    slot => {
      expect(resolves(slot)).toBe(true);
    },
  );

  it('defines the owner/counterparty filter pair that has already caused a scoping bug', () => {
    expect(resolves('byOwners')).toBe(true);
    expect(resolves('byBusinesses')).toBe(true);
    expect(resolves('memberBusinessIds')).toBe(true);
  });
});

describe('glossary is internally consistent', () => {
  it('has unique terms', () => {
    expect(TERMS.size).toBe(GLOSSARY.length);
  });

  it('has no colliding spellings across entries', () => {
    const seen = new Map<string, string>();
    for (const entry of GLOSSARY) {
      for (const spelling of [entry.term, ...(entry.aliases ?? [])]) {
        const folded = fold(spelling);
        const owner = seen.get(folded);
        expect(
          owner === undefined || owner === entry.term,
          `"${spelling}" is claimed by both "${owner}" and "${entry.term}"`,
        ).toBe(true);
        seen.set(folded, entry.term);
      }
    }
  });

  it('only cross-references terms that exist', () => {
    for (const entry of GLOSSARY) {
      for (const related of entry.seeAlso ?? []) {
        expect(TERMS.has(related), `${entry.term} -> ${related}`).toBe(true);
      }
    }
  });

  it('only cross-references tools that are registered', () => {
    for (const entry of GLOSSARY) {
      for (const tool of entry.tools ?? []) {
        expect(toolRegistry.has(tool), `${entry.term} -> ${tool}`).toBe(true);
      }
    }
  });

  it('uses only declared topics, and every topic has entries', () => {
    const used = new Set(GLOSSARY.map(entry => entry.topic));
    for (const topic of GLOSSARY_TOPICS) {
      expect(used.has(topic), `topic "${topic}" has no entries`).toBe(true);
    }
    expect(used.size).toBe(GLOSSARY_TOPICS.length);
  });

  it('gives every entry a single-line summary and a non-empty detail', () => {
    for (const entry of GLOSSARY) {
      expect(entry.summary.trim().length, entry.term).toBeGreaterThan(0);
      expect(entry.summary, entry.term).not.toContain('\n');
      expect(entry.detail.trim().length, entry.term).toBeGreaterThan(0);
      // The detail must add something beyond restating the summary.
      expect(entry.detail.length, entry.term).toBeGreaterThan(entry.summary.length);
    }
  });
});

describe('glossary tool registration', () => {
  it('is advertised second, right behind discovery', () => {
    expect(toolRegistry.describe()[1]?.name).toBe(explainTerminologyTool.name);
  });

  it('is callable cold — no required parameters', () => {
    const descriptor = toolRegistry.describe().find(tool => tool.name === explainTerminologyTool.name);

    expect(descriptor?.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    expect(descriptor?.inputSchema.required).toBeUndefined();
  });

  it('needs no business scope and carries no business data', () => {
    expect(explainTerminologyTool.policy.requiresBusinessScope).toBe(false);
    expect(explainTerminologyTool.policy.dataClassification).toBe('public');
    expect(explainTerminologyTool.policy.requiredRoles).toBeUndefined();
  });
});
