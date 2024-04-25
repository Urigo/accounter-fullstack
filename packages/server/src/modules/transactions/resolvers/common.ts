import { TransactionDirection } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
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
  eventDate: DbTransaction => dateToTimelessDateString(DbTransaction.event_date),
  effectiveDate: DbTransaction => effectiveDateSupplement(DbTransaction),
  direction: DbTransaction =>
    parseFloat(DbTransaction.amount) > 0 ? TransactionDirection.Credit : TransactionDirection.Debit,
  amount: DbTransaction => formatFinancialAmount(DbTransaction.amount, DbTransaction.currency),
  sourceDescription: DbTransaction => DbTransaction.source_description ?? '',
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
  createdAt: DbTransaction => DbTransaction.created_at,
  updatedAt: DbTransaction => DbTransaction.updated_at,
  isFee: DbTransaction => DbTransaction.is_fee,
};

export const commonChargeFields: TransactionsModule.ChargeResolvers = {
  transactions: (DbCharge, _, { injector }) =>
    injector.get(TransactionsProvider).getTransactionsByChargeIDLoader.load(DbCharge.id),
};
