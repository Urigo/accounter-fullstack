import { TransactionDirection } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { effectiveDateSupplement } from '../helpers/effective-date.helper.js';
import { TransactionsProvider } from '../providers/transactions.provider.js';
import type { TransactionsModule } from '../types.js';

export const commonTransactionFields: TransactionsModule.TransactionResolvers = {
  id: transactionId => transactionId,
  referenceKey: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.source_reference),
  eventDate: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => dateToTimelessDateString(res.event_date)),
  effectiveDate: async (transactionId, __dirname, { injector }) => {
    const transaction = await injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId);
    return effectiveDateSupplement(transaction);
  },
  sourceEffectiveDate: async (transactionId, __dirname, { injector }) => {
    const transaction = await injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId);
    const date = transaction.debit_date ? dateToTimelessDateString(transaction.debit_date) : null;
    if (date && date !== effectiveDateSupplement(transaction)) {
      return date;
    }
    return null;
  },
  exactEffectiveDate: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.debit_timestamp),
  direction: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res =>
        parseFloat(res.amount) > 0 ? TransactionDirection.Credit : TransactionDirection.Debit,
      ),
  amount: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => formatFinancialAmount(res.amount, res.currency)),
  sourceDescription: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.source_description ?? ''),
  balance: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => formatFinancialAmount(res.current_balance)),
  createdAt: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.created_at),
  updatedAt: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.updated_at),
  isFee: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.is_fee),
  chargeId: async (transactionId, __dirname, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionByIdLoader.load(transactionId)
      .then(res => res.charge_id),
};

export const commonChargeFields: TransactionsModule.ChargeResolvers = {
  transactions: (chargeId, _, { injector }) =>
    injector
      .get(TransactionsProvider)
      .transactionsByChargeIDLoader.load(chargeId)
      .then(res => res.map(t => t.id)),
};
