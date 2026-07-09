import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChargeTransactionsMeta } from '../../../helpers/common.helper.js';
import { getVatRecords } from '../../../../reports/resolvers/get-vat-records.resolver.js';
import {
  calculateMonthlyVatTotalAmount,
  isWithinMonthlyVatAmountTolerance,
} from '../../../../reports/helpers/vat-report.helper.js';
import { missingMonthlyVatInfoSuggestions } from '../monthly-vat-suggestions.resolver.js';
import type { Injector } from 'graphql-modules';
import type { ResolversParentTypes } from '../../../../../__generated__/types.js';

vi.mock('../../../helpers/common.helper.js', () => ({
  getChargeTransactionsMeta: vi.fn(),
}));

vi.mock('../../../../reports/resolvers/get-vat-records.resolver.js', () => ({
  getVatRecords: vi.fn(),
}));

vi.mock('../../../../reports/helpers/vat-report.helper.js', () => ({
  calculateMonthlyVatTotalAmount: vi.fn(),
  isWithinMonthlyVatAmountTolerance: vi.fn(),
}));

describe('missingMonthlyVatInfoSuggestions', () => {
  const injector = {} as Injector;
  const charge = {
    id: 'charge-1',
    owner_id: 'owner-1',
  } as unknown as ResolversParentTypes['Charge'];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a VAT month suggestion when previous month VAT amount matches transactions', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -130,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [] } as never);
    vi.mocked(calculateMonthlyVatTotalAmount).mockReturnValue(130);
    vi.mocked(isWithinMonthlyVatAmountTolerance).mockReturnValue(true);

    const result = await missingMonthlyVatInfoSuggestions(
      charge,
      {} as never,
      { injector } as never,
      {} as never,
    );

    expect(getVatRecords).toHaveBeenCalledWith(
      {
        filters: {
          financialEntityId: 'owner-1',
          monthDate: '2026-04-15',
        },
      },
      injector,
    );
    expect(result).toEqual({
      description: 'VAT for 04/2026',
      tags: [],
    });
  });

  it('returns null when transactions amount is missing', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: null,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);

    const result = await missingMonthlyVatInfoSuggestions(
      charge,
      {} as never,
      { injector } as never,
      {} as never,
    );

    expect(getVatRecords).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null when no transaction date exists', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -130,
      transactionsMinDebitDate: null,
      transactionsMinEventDate: null,
    } as never);

    const result = await missingMonthlyVatInfoSuggestions(
      charge,
      {} as never,
      { injector } as never,
      {} as never,
    );

    expect(getVatRecords).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null when VAT total does not match transactions amount', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -130,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [] } as never);
    vi.mocked(calculateMonthlyVatTotalAmount).mockReturnValue(90);
    vi.mocked(isWithinMonthlyVatAmountTolerance).mockReturnValue(false);

    const result = await missingMonthlyVatInfoSuggestions(
      charge,
      {} as never,
      { injector } as never,
      {} as never,
    );

    expect(result).toBeNull();
  });

  it('returns null when VAT records fetching throws', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -130,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockRejectedValue(new Error('boom'));

    const result = await missingMonthlyVatInfoSuggestions(
      charge,
      {} as never,
      { injector } as never,
      {} as never,
    );

    expect(result).toBeNull();
  });
});
