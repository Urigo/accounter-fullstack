import { readFileSync } from 'node:fs';
import { RULES } from '../../src/validate/rules.js';

const SPEC = readFileSync(new URL('../../documentation/SPEC.md', import.meta.url), 'utf8');

/** First cell of every table row in SPEC §10.1–§10.7, backticks stripped. */
function catalogueIds(): Set<string> {
  const start = SPEC.indexOf('\n### 10.1 ');
  const end = SPEC.indexOf('\n## 11. ', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const ids = new Set<string>();
  for (const line of SPEC.slice(start, end).split('\n')) {
    if (!line.startsWith('|')) {
      continue;
    }
    const cell = line.split('|')[1]?.trim().replaceAll('`', '') ?? '';
    if (cell !== '' && !/^-+$/.test(cell)) {
      ids.add(cell);
    }
  }
  return ids;
}

describe('RULES and SPEC §10', () => {
  it('reads the §10 catalogue', () => {
    const ids = catalogueIds();
    expect(ids).toContain('struct.taxYear.unsupported');
    expect(ids).toContain('parse.derivedMismatch');
  });

  it('every RULES id appears in SPEC §10', () => {
    const ids = catalogueIds();
    expect(RULES.map(rule => rule.id).filter(id => !ids.has(id))).toEqual([]);
  });
});
