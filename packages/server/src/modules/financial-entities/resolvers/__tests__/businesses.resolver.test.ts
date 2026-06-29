import { describe, expect, it } from 'vitest';
import type { IGetBusinessesByIdsResult } from '../../types.js';
import { businessesResolvers } from '../businesses.resolver.js';

type FieldResolver = (parent: IGetBusinessesByIdsResult) => unknown;

function resolveField(field: string, parent: Partial<IGetBusinessesByIdsResult>): unknown {
  const resolver = (
    businessesResolvers.LtdFinancialEntity as Record<string, FieldResolver>
  )[field];
  return resolver(parent as IGetBusinessesByIdsResult);
}

describe('LtdFinancialEntity.sortCode resolver', () => {
  it('maps sortCode from the sort_code column', () => {
    expect(resolveField('sortCode', { sort_code: 910 })).toBe(910);
  });

  it('returns null when sort_code is null', () => {
    expect(resolveField('sortCode', { sort_code: null })).toBeNull();
  });
});
