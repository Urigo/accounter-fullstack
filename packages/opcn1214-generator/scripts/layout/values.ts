import type { EnumValue } from '../../src/layout/types.js';

const NUMBER = /^\d+$/;
const RANGE = /^(\d+)\.\.(\d+)$/;

function parseNumber(text: string, item: string): number {
  if (!NUMBER.test(text)) {
    throw new Error(`values: "${item}" is not a non-negative integer`);
  }
  return Number(text);
}

/**
 * Parses the `values` column of the layout CSVs (SPEC §4.2): `;`-separated items, each `n`,
 * `n..m` (inclusive range) or `n=label` (split on the first `=` only, so labels may contain `=`).
 * An empty cell means "no listed values" and yields undefined; anything else malformed throws.
 */
export function parseValues(text: string): EnumValue[] | undefined {
  if (text === '') {
    return undefined;
  }
  return text.split(';').flatMap((item): EnumValue[] => {
    const separator = item.indexOf('=');
    if (separator !== -1) {
      const label = item.slice(separator + 1);
      if (label === '') {
        throw new Error(`values: "${item}" has an empty label`);
      }
      return [{ value: parseNumber(item.slice(0, separator), item), label }];
    }
    const range = RANGE.exec(item);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > to) {
        throw new Error(`values: range "${item}" is empty`);
      }
      return Array.from({ length: to - from + 1 }, (_, offset) => ({ value: from + offset }));
    }
    return [{ value: parseNumber(item, item) }];
  });
}
