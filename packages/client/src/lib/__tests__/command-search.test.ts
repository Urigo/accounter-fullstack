import { describe, expect, it } from 'vitest';
import { rankOptions, scoreSearch } from '../command-search.js';

describe('scoreSearch', () => {
  it('ignores letter case', () => {
    const scores = ['goo', 'Goo', 'GOO', 'gOo'].map(search => scoreSearch(search, ['Google Ltd']));
    expect(new Set(scores).size).toBe(1);
    expect(scores[0]).toBeGreaterThan(0);
  });

  it('matches upper-case search against lower-case texts', () => {
    expect(scoreSearch('SHUF', ['shufersal'])).toBeGreaterThan(0);
  });

  it('only looks at the given texts', () => {
    expect(scoreSearch('abcd', ['Google Ltd'])).toBe(0);
  });

  it('skips blank and missing texts', () => {
    expect(scoreSearch('devel', [null, undefined, '  ', 'Research & Development'])).toBe(0.75);
    expect(scoreSearch('x', [null, ''])).toBe(0);
  });

  it('ranks prefix above word start above any other substring', () => {
    const prefix = scoreSearch('bez', ['Bezeq International']);
    const wordStart = scoreSearch('inter', ['Bezeq International']);
    const substring = scoreSearch('zeq', ['Bezeq International']);
    expect(prefix).toBe(1);
    expect(wordStart).toBe(0.75);
    expect(substring).toBe(0.5);
  });

  it('takes the best score across texts', () => {
    expect(scoreSearch('acme', ['Some Corp', 'Acme description'])).toBe(1);
  });

  it('is a plain substring match, not a fuzzy one', () => {
    expect(scoreSearch('gle', ['Google'])).toBeGreaterThan(0);
    expect(scoreSearch('ggl', ['Google'])).toBe(0);
  });

  it('matches everything for an empty or blank search', () => {
    expect(scoreSearch('', ['Google'])).toBe(1);
    expect(scoreSearch('   ', ['Google'])).toBe(1);
  });

  it('normalises whitespace in the search', () => {
    expect(scoreSearch('  google   ltd ', ['Google Ltd'])).toBe(1);
  });
});

describe('rankOptions', () => {
  const OPTIONS = [
    { id: 1, label: 'Delta ltd' },
    { id: 2, label: 'Alpha ltd' },
    { id: 3, label: 'Charlie ltd' },
    { id: 4, label: 'Bezeq' },
  ];
  const labels = (search: string): string[] =>
    rankOptions(OPTIONS, search, option => [option.label]).map(option => option.label);

  it('returns every option in its original order for an empty search', () => {
    expect(labels('')).toEqual(['Delta ltd', 'Alpha ltd', 'Charlie ltd', 'Bezeq']);
    expect(labels('  ')).toEqual(['Delta ltd', 'Alpha ltd', 'Charlie ltd', 'Bezeq']);
  });

  it('drops options that do not match', () => {
    expect(labels('ltd')).not.toContain('Bezeq');
    expect(labels('nothing')).toEqual([]);
  });

  it('puts better matches first', () => {
    // "Alpha ltd" starts with "a"; the others only contain one.
    expect(labels('a')).toEqual(['Alpha ltd', 'Delta ltd', 'Charlie ltd']);
  });

  it('keeps tied options in their original order', () => {
    expect(labels('ltd')).toEqual(['Delta ltd', 'Alpha ltd', 'Charlie ltd']);
  });

  it('does not mutate the input', () => {
    const before = [...OPTIONS];
    rankOptions(OPTIONS, 'a', option => [option.label]);
    rankOptions(OPTIONS, '', option => [option.label]);
    expect(OPTIONS).toEqual(before);
  });
});
