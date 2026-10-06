import type { Maybe, ResolverFn, ResolversParentTypes } from '../../../../__generated__/types.js';
import {
  getTimelessDateMonth,
  getTimelessDateYear,
  timelessDateFromParts,
} from '../../../../shared/helpers/index.js';
import {
  calculateMonthlyVatTotalAmount,
  isWithinMonthlyVatAmountTolerance,
  type RawVatReportRecord,
} from '../../../reports/helpers/vat-report.helper.js';
import { getVatRecords } from '../../../reports/resolvers/get-vat-records.resolver.js';
import { getChargeTransactionsMeta } from '../../helpers/common.helper.js';
import { Suggestion } from './charge-suggestions.resolver.js';

export const missingMonthlyVatInfoSuggestions: ResolverFn<
  Maybe<Suggestion>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (DbCharge, _, { injector }) => {
  try {
    const { transactionsAmount, transactionsMinDebitDate, transactionsMinEventDate } =
      await getChargeTransactionsMeta(DbCharge, injector);

    if (transactionsAmount == null) {
      return null;
    }

    const transactionDate = transactionsMinEventDate ?? transactionsMinDebitDate;
    if (!transactionDate) {
      return null;
    }

    // mid-month of the month before the transaction (month 0 rolls back to December)
    const monthDate = timelessDateFromParts(
      getTimelessDateYear(transactionDate),
      getTimelessDateMonth(transactionDate) - 1,
      15,
    );
    const [reportYear, reportMonth] = monthDate.split('-');

    const { income, expenses } = await getVatRecords(
      {
        filters: {
          financialEntityId: DbCharge.owner_id,
          monthDate,
        },
      },
      injector,
      { includeChargeBuckets: false },
    );

    const monthlyVatTotalAmount = calculateMonthlyVatTotalAmount(
      income as RawVatReportRecord[],
      expenses as RawVatReportRecord[],
    );

    if (!isWithinMonthlyVatAmountTolerance(monthlyVatTotalAmount, transactionsAmount)) {
      return null;
    }

    return {
      description: `VAT for ${reportMonth}/${reportYear}`,
      tags: [],
    };
  } catch (error) {
    console.error('Error in missingMonthlyVatInfoSuggestions:', error);
    return null;
  }
};
