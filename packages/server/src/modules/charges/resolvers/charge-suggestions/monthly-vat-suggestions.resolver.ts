import { format } from 'date-fns';
import type { Maybe, ResolverFn, ResolversParentTypes } from '../../../../__generated__/types.js';
import { dateToTimelessDateString } from '../../../../shared/helpers/index.js';
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

    const transactionDate = (transactionsMinEventDate ??
      transactionsMinDebitDate ??
      null) as Date | null;
    if (!transactionDate) {
      return null;
    }

    const reportMonthDate = new Date(
      transactionDate.getUTCFullYear(),
      transactionDate.getUTCMonth() - 1,
      15,
    );
    const monthDate = dateToTimelessDateString(reportMonthDate);

    const { income, expenses } = await getVatRecords(
      {
        filters: {
          financialEntityId: DbCharge.owner_id,
          monthDate,
        },
      },
      injector,
    );

    const monthlyVatTotalAmount = calculateMonthlyVatTotalAmount(
      income as RawVatReportRecord[],
      expenses as RawVatReportRecord[],
    );

    if (!isWithinMonthlyVatAmountTolerance(monthlyVatTotalAmount, transactionsAmount)) {
      return null;
    }

    return {
      description: `VAT for ${format(reportMonthDate, 'MM/yyyy')}`,
      tags: [],
    };
  } catch (error) {
    console.error('Error in missingMonthlyVatInfoSuggestions:', error);
    return null;
  }
};
