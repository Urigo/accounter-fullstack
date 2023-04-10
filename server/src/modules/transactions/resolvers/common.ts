import { TransactionDirection } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import type { TransactionsModule } from '../types.js';

export const commonTransactionFields:
  | TransactionsModule.ConversionTransactionResolvers
  | TransactionsModule.FeeTransactionResolvers
  | TransactionsModule.WireTransactionResolvers
  | TransactionsModule.CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceNumber: DbTransaction => DbTransaction.bank_reference ?? 'Missing',
  createdAt: DbTransaction => DbTransaction.event_date,
  effectiveDate: DbTransaction => effectiveDateSupplement(DbTransaction),
  direction: DbTransaction =>
    parseFloat(DbTransaction.amount) > 0 ? TransactionDirection.Credit : TransactionDirection.Debit,
  amount: DbTransaction => formatFinancialAmount(DbTransaction.amount, DbTransaction.currency),
  description: DbTransaction => DbTransaction.source_description ?? '',
  userNote: DbTransaction => DbTransaction.user_description,
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
};
