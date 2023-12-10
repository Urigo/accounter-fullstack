import { format } from 'date-fns';
import { TransactionDirection } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import { TransactionsProvider } from '../providers/transactions.provider.js';
import type { TransactionsModule } from '../types.js';

export const commonTransactionFields:
  | TransactionsModule.ConversionTransactionResolvers
  | TransactionsModule.FeeTransactionResolvers
  | TransactionsModule.WireTransactionResolvers
  | TransactionsModule.CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceId: DbTransaction => DbTransaction.source_id,
  referenceKey: DbTransaction => DbTransaction.source_reference,
  eventDate: DbTransaction => format(DbTransaction.event_date, 'yyyy-MM-dd') as TimelessDateString,
  effectiveDate: DbTransaction => effectiveDateSupplement(DbTransaction),
  direction: DbTransaction =>
    parseFloat(DbTransaction.amount) > 0 ? TransactionDirection.Credit : TransactionDirection.Debit,
  amount: DbTransaction => formatFinancialAmount(DbTransaction.amount, DbTransaction.currency),
  sourceDescription: DbTransaction => DbTransaction.source_description ?? '',
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
  createdOn: DbTransaction => DbTransaction.created_on,
  updatedOn: DbTransaction => DbTransaction.updated_on,
};

export const commonChargeFields: TransactionsModule.ChargeResolvers = {
  transactions: (DbCharge, _, { injector }) =>
    injector.get(TransactionsProvider).getTransactionsByChargeIDLoader.load(DbCharge.id),
};
