import { TransactionDirection } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import { TransactionsProvider } from '../providers/transactions.provider.js';
import type { TransactionsModule } from '../types.js';

export const commonTransactionFields: TransactionsModule.TransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceId: DbTransaction => DbTransaction.source_id,
  referenceKey: DbTransaction => DbTransaction.source_reference,
  eventDate: DbTransaction => dateToTimelessDateString(DbTransaction.event_date),
  effectiveDate: DbTransaction => effectiveDateSupplement(DbTransaction),
  sourceEffectiveDate: DbTransaction => {
    const date = DbTransaction.source_debit_date
      ? dateToTimelessDateString(DbTransaction.source_debit_date)
      : null;
    if (date && date !== effectiveDateSupplement(DbTransaction)) {
      return date;
    }
    return null;
  },
  exactEffectiveDate: DbTransaction => DbTransaction.debit_timestamp,
  direction: DbTransaction =>
    parseFloat(DbTransaction.amount) > 0 ? TransactionDirection.Credit : TransactionDirection.Debit,
  amount: DbTransaction => formatFinancialAmount(DbTransaction.amount, DbTransaction.currency),
  sourceDescription: DbTransaction => DbTransaction.source_description ?? '',
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
  createdAt: DbTransaction => DbTransaction.created_at,
  updatedAt: DbTransaction => DbTransaction.updated_at,
  isFee: DbTransaction => DbTransaction.is_fee,
  chargeId: DbTransaction => DbTransaction.charge_id,
};

export const commonChargeFields: TransactionsModule.ChargeResolvers = {
  transactions: (DbCharge, _, { injector }) =>
    injector.get(TransactionsProvider).getTransactionsByChargeIDLoader.load(DbCharge.id),
};
