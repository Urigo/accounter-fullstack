import { readFileSync } from 'node:fs';
import { RULES } from '../../src/validate/rules.js';

const SPEC = readFileSync(new URL('../../documentation/SPEC.md', import.meta.url), 'utf8');

interface CatalogueRow {
  section: string;
  /** 'E' / 'W'; absent in §10.7 (parse-only rules are errors). */
  severity?: string;
  /** 'spec' / 'derived' / 'checker' (footnote markers stripped); absent in §10.7. */
  source?: string;
}

/** Every rule row of SPEC §10.1–§10.7, by rule ID (the first cell, backticks stripped). */
function catalogue(): Map<string, CatalogueRow> {
  const start = SPEC.indexOf('\n### 10.1 ');
  const end = SPEC.indexOf('\n## 11. ', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const rows = new Map<string, CatalogueRow>();
  let section = '';
  for (const line of SPEC.slice(start, end).split('\n')) {
    section = /^### (10\.\d+) /.exec(line)?.[1] ?? section;
    if (!line.startsWith('|')) {
      continue;
    }
    const cells = line.split('|').map(text => text.trim());
    const id = cells[1]?.replaceAll('`', '') ?? '';
    if (id === '' || id === 'Rule ID' || /^-+$/.test(id)) {
      continue;
    }
    expect(rows.has(id), `${id} is listed twice in SPEC §10`).toBe(false);
    rows.set(
      id,
      section === '10.7'
        ? { section }
        : { section, severity: cells[2], source: cells[3]?.replaceAll(String.raw`\*`, '') },
    );
  }
  return rows;
}

describe('RULES and SPEC §10', () => {
  it('reads the §10 catalogue', () => {
    const rows = catalogue();
    expect(rows.get('struct.taxYear.unsupported')).toEqual({
      section: '10.1',
      severity: 'E',
      source: 'derived',
    });
    expect(rows.get('main.kibbutz.code226')?.source).toBe('spec');
    expect(rows.get('parse.derivedMismatch')).toEqual({ section: '10.7' });
  });

  it('RULES and the §10 tables hold the same rule IDs', () => {
    const specIds = [...catalogue().keys()].sort();
    const ruleIds = RULES.map(rule => rule.id).sort();
    expect(ruleIds).toEqual(specIds);
  });

  it('every rule has the severity and source of its §10 row', () => {
    const rows = catalogue();
    for (const rule of RULES) {
      const row = rows.get(rule.id);
      if (row?.section === '10.7') {
        expect({ id: rule.id, severity: rule.severity, scope: rule.scope }).toEqual({
          id: rule.id,
          severity: 'error',
          scope: 'parse',
        });
      } else {
        expect({ id: rule.id, severity: row?.severity, source: row?.source }).toEqual({
          id: rule.id,
          severity: rule.severity === 'error' ? 'E' : 'W',
          source: rule.source,
        });
      }
    }
  });
});
