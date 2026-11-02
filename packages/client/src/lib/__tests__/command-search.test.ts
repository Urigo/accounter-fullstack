import { describe, expect, it } from 'vitest';
import { commandSearchFilter } from '../command-search.js';

const UUID = '3f2a8c1e-0000-4000-8000-00000000abcd';

describe('commandSearchFilter', () => {
  it('ignores letter case', () => {
    const scores = ['goo', 'Goo', 'GOO', 'gOo'].map(search =>
      commandSearchFilter(UUID, search, ['Google Ltd']),
    );
    expect(new Set(scores).size).toBe(1);
    expect(scores[0]).toBeGreaterThan(0);
  });

  it('matches upper-case search against lower-case labels', () => {
    expect(commandSearchFilter(UUID, 'SHUF', ['shufersal'])).toBeGreaterThan(0);
  });

  it('does not match on the item value when keywords are present', () => {
    expect(commandSearchFilter(UUID, 'abcd', ['Google Ltd'])).toBe(0);
    expect(commandSearchFilter(UUID, '3f2a', ['Google Ltd'])).toBe(0);
  });

  it('falls back to the value when there are no meaningful keywords', () => {
    expect(commandSearchFilter('Research & Development', 'research', undefined)).toBe(1);
    expect(commandSearchFilter('Research & Development', 'DEVEL', ['', '  '])).toBeGreaterThan(0);
  });

  it('ranks prefix above word start above any other substring', () => {
    const prefix = commandSearchFilter(UUID, 'bez', ['Bezeq International']);
    const wordStart = commandSearchFilter(UUID, 'inter', ['Bezeq International']);
    const substring = commandSearchFilter(UUID, 'zeq', ['Bezeq International']);
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(0);
  });

  it('takes the best score across keywords', () => {
    expect(commandSearchFilter(UUID, 'acme', ['Some Corp', 'Acme description'])).toBe(1);
  });

  it('is a plain substring match, not a fuzzy one', () => {
    expect(commandSearchFilter(UUID, 'gle', ['Google'])).toBeGreaterThan(0);
    expect(commandSearchFilter(UUID, 'ggl', ['Google'])).toBe(0);
  });

  it('keeps every item for an empty or blank search', () => {
    expect(commandSearchFilter(UUID, '', ['Google'])).toBe(1);
    expect(commandSearchFilter(UUID, '   ', ['Google'])).toBe(1);
  });

  it('normalises whitespace in the search', () => {
    expect(commandSearchFilter(UUID, '  google   ltd ', ['Google Ltd'])).toBe(1);
  });
});
