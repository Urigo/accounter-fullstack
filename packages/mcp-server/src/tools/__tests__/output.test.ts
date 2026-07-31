import { describe, expect, it } from 'vitest';
import { MAX_TOOL_RESULT_BYTES, shapeListResult } from '../output.js';

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
