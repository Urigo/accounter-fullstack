import { describe, it, expect } from 'vitest';
import { getAllUseCases } from '../use-cases/index.js';

describe('Use-Case Registry', () => {
  it('has no duplicate IDs across all categories', () => {
    const allUseCases = getAllUseCases();
    const ids = allUseCases.map(uc => uc.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all use-cases have required fields', () => {
    const allUseCases = getAllUseCases();
    allUseCases.forEach(uc => {
      expect(uc.id).toBeTruthy();
      expect(uc.name).toBeTruthy();
      expect(uc.category).toBeTruthy();
      expect(uc.fixtures).toBeDefined();
      expect(Array.isArray(uc.fixtures.businesses)).toBe(true);
      expect(Array.isArray(uc.fixtures.taxCategories)).toBe(true);
      expect(Array.isArray(uc.fixtures.financialAccounts)).toBe(true);
      expect(Array.isArray(uc.fixtures.charges)).toBe(true);
      expect(Array.isArray(uc.fixtures.transactions)).toBe(true);
      expect(Array.isArray(uc.fixtures.documents)).toBe(true);
    });
  });
});
