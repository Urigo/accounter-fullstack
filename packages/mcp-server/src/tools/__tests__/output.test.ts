import { describe, expect, it } from 'vitest';
import { MAX_TOOL_RESULT_BYTES, shapeListResult, shapeWriteResult } from '../output.js';

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

describe('shapeListResult — within limits', () => {
  it('returns all items, untruncated, with counts', () => {
    const result = shapeListResult({ items: [{ a: 1 }, { a: 2 }], itemsKey: 'things' });
    const structured = result.structuredContent as {
      things: unknown[];
      returnedCount: number;
      totalCount: number;
      truncated: boolean;
      continuation?: unknown;
    };
    expect(structured.things).toHaveLength(2);
    expect(structured.returnedCount).toBe(2);
    expect(structured.totalCount).toBe(2);
    expect(structured.truncated).toBe(false);
    expect(structured.continuation).toBeUndefined();
  });

  it('merges extra fields and uses a custom summary', () => {
    const result = shapeListResult({
      items: [{ a: 1 }],
      itemsKey: 'things',
      extra: { page: 2 },
      summarize: (shown, total) => `${shown}/${total}`,
    });
    const structured = result.structuredContent as { page: number };
    expect(structured.page).toBe(2);
    expect(result.content[0].text).toBe('1/1');
  });
});

describe('shapeListResult — default summary', () => {
  it('reports "No results." when there are no items', () => {
    const result = shapeListResult({ items: [], itemsKey: 'things' });
    expect(result.content[0].text).toBe('No results.');
    const structured = result.structuredContent as { totalCount: number; truncated: boolean };
    expect(structured.totalCount).toBe(0);
    expect(structured.truncated).toBe(false);
  });

  it('reports returned-of-total with a truncated marker', () => {
    const result = shapeListResult({ items: [{ a: 1 }], itemsKey: 'things', total: 5 });
    expect(result.content[0].text).toBe('Returning 1 of 5 result(s) (truncated).');
  });

  it('omits the truncated marker when everything is returned', () => {
    const result = shapeListResult({ items: [{ a: 1 }, { a: 2 }], itemsKey: 'things' });
    expect(result.content[0].text).toBe('Returning 2 of 2 result(s).');
  });
});

describe('shapeListResult — result cap (total > items)', () => {
  it('marks truncated with a result_cap continuation when more exist upstream', () => {
    const result = shapeListResult({ items: [{ a: 1 }], itemsKey: 'things', total: 10 });
    const structured = result.structuredContent as {
      truncated: boolean;
      continuation: { reason: string; returnedCount: number; totalCount: number };
    };
    expect(structured.truncated).toBe(true);
    expect(structured.continuation.reason).toBe('result_cap');
    expect(structured.continuation.returnedCount).toBe(1);
    expect(structured.continuation.totalCount).toBe(10);
  });
});

describe('shapeListResult — payload-size guard', () => {
  it('drops whole trailing items to fit the byte cap and stays valid JSON', () => {
    // Each item is ~1KB; cap forces dropping some.
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, blob: 'x'.repeat(1000) }));
    const maxBytes = 20_000;
    const result = shapeListResult({ items, itemsKey: 'rows', maxBytes });

    const structured = result.structuredContent as {
      rows: Array<{ id: number }>;
      returnedCount: number;
      totalCount: number;
      truncated: boolean;
      continuation: { reason: string };
    };
    // Fits under the cap.
    expect(bytes(structured)).toBeLessThanOrEqual(maxBytes);
    // Dropped some, but kept whole items (a prefix of the input).
    expect(structured.rows.length).toBeGreaterThan(0);
    expect(structured.rows.length).toBeLessThan(100);
    expect(structured.rows.map(r => r.id)).toEqual(
      Array.from({ length: structured.rows.length }, (_, i) => i),
    );
    expect(structured.returnedCount).toBe(structured.rows.length);
    expect(structured.totalCount).toBe(100);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation.reason).toBe('payload_size');
  });

  it('exposes a sane default byte cap', () => {
    expect(MAX_TOOL_RESULT_BYTES).toBeGreaterThan(0);
  });

  it('returns zero items when even a single item cannot fit', () => {
    const items = [{ blob: 'x'.repeat(10_000) }];
    const result = shapeListResult({ items, itemsKey: 'rows', maxBytes: 100 });
    const structured = result.structuredContent as { rows: unknown[]; returnedCount: number };
    expect(structured.rows).toHaveLength(0);
    expect(structured.returnedCount).toBe(0);
  });
});

describe('mirroring the payload into content', () => {
  /**
   * `structuredContent` is the field a client may ignore; a `content` text block
   * is the one a model is guaranteed to read. Both shapers must put the payload
   * in both places — see `mirroring-contract.test.ts` for the registry-wide
   * version of this rule.
   */
  it('shapeListResult mirrors the structured payload verbatim', () => {
    const result = shapeListResult({ items: [{ id: 'row-1' }], itemsKey: 'things' });

    expect(result.content).toHaveLength(2);
    expect(result.content[0].text).toBe('Returning 1 of 1 result(s).');
    expect(JSON.parse(result.content[1].text)).toEqual(result.structuredContent);
    expect(result.content[1].text).toContain('row-1');
  });

  it('shapeWriteResult mirrors its outcome, so the model can see what changed', () => {
    const result = shapeWriteResult({
      action: 'update_tags',
      summary: 'Updated 2 charge(s).',
      outcome: { updatedCount: 2 },
      items: { key: 'charges', values: [{ id: 'charge-1' }] },
    });

    expect(result.content).toHaveLength(2);
    expect(JSON.parse(result.content[1].text)).toEqual(result.structuredContent);
    expect(result.content[1].text).toContain('charge-1');
  });

  /**
   * The mirrored text is the same string `fittingCount` measures, so the 60 KB
   * cap still describes exactly what the model consumes — it did not silently
   * become a 120 KB model-facing budget.
   */
  it('keeps the byte cap measuring what the model actually reads', () => {
    const items = Array.from({ length: 5000 }, (_, i) => ({ id: `row-${i}`, pad: 'x'.repeat(50) }));
    const result = shapeListResult({ items, itemsKey: 'things' });

    expect(bytes(result.structuredContent)).toBeLessThanOrEqual(MAX_TOOL_RESULT_BYTES);
    expect(Buffer.byteLength(result.content[1].text, 'utf8')).toBeLessThanOrEqual(
      MAX_TOOL_RESULT_BYTES,
    );
  });
});
