import { describe, expect, it } from 'vitest';
import type { IGetContractsByIdsResult } from '../../../contracts/types.js';
import { buildContractDocumentDescription } from '../issue-document.helper.js';

function buildContract(overrides: Partial<IGetContractsByIdsResult>): IGetContractsByIdsResult {
  return {
    product: 'hive',
    plan: 'pro',
    billing_cycle: 'monthly',
    // pg parses `date` columns to local-midnight Date objects; mirror that here so
    // formatting is timezone-independent.
    start_date: new Date(2025, 0, 15),
    end_date: new Date(2026, 0, 14),
    ...overrides,
  } as unknown as IGetContractsByIdsResult;
}

describe('buildContractDocumentDescription', () => {
  it('uses the billed month for monthly contracts', () => {
    const contract = buildContract({ billing_cycle: 'monthly' });

    // issueMonth is the previous month; the description points at it (issueMonth + 1 → previous month)
    expect(buildContractDocumentDescription(contract, '2026-05-01')).toBe(
      'GraphQL Hive Pro Plan - May 2026',
    );
  });

  it('uses the contract start & end dates for annual contracts', () => {
    const contract = buildContract({ billing_cycle: 'annual' });

    expect(buildContractDocumentDescription(contract, '2025-01-01')).toBe(
      'GraphQL Hive Pro Plan January 15th, 2025 → January 14th, 2026',
    );
  });

  it('ignores the issue month for annual contracts', () => {
    const contract = buildContract({ billing_cycle: 'annual' });

    expect(buildContractDocumentDescription(contract, '2025-01-01')).toBe(
      buildContractDocumentDescription(contract, '2025-08-01'),
    );
  });
});
