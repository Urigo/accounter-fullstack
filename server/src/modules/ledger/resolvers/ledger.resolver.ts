import { Currency, Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { LedgerModule } from '../types.js';
import { ledgerCounterparty } from './ledger-counterparty.resolver.js';
import { generateLedgerRecords } from './ledger-generation.resolver.js';

export const ledgerResolvers: LedgerModule.Resolvers &
  Pick<Resolvers, 'GeneratedLedgerRecords' | 'LedgerCounterparty'> = {
  LedgerRecord: {
    id: () => '',
    debitAmount1: DbLedgerRecord =>
      DbLedgerRecord.debitAmount1 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debitAmount1, DbLedgerRecord.currency),
    debitAmount2: DbLedgerRecord =>
      DbLedgerRecord.debitAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.debitAmount2, DbLedgerRecord.currency),
    creditAmount1: DbLedgerRecord =>
      DbLedgerRecord.creditAmount1 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.creditAmount1, DbLedgerRecord.currency),
    creditAmount2: DbLedgerRecord =>
      DbLedgerRecord.creditAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.creditAmount2, DbLedgerRecord.currency),
    localCurrencyDebitAmount1: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.localCurrencyDebitAmount1, Currency.Ils),
    localCurrencyDebitAmount2: DbLedgerRecord =>
      DbLedgerRecord.localCurrencyDebitAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.localCurrencyDebitAmount2, Currency.Ils),
    localCurrencyCreditAmount1: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.localCurrencyCreditAmount1, Currency.Ils),
    localCurrencyCreditAmount2: DbLedgerRecord =>
      DbLedgerRecord.localCurrencyCreditAmount2 == null
        ? null
        : formatFinancialAmount(DbLedgerRecord.localCurrencyCreditAmount2, Currency.Ils),
    invoiceDate: DbLedgerRecord => DbLedgerRecord.invoiceDate,
    valueDate: DbLedgerRecord => DbLedgerRecord.valueDate,
    description: DbLedgerRecord => DbLedgerRecord.description ?? null,
    reference1: DbLedgerRecord => DbLedgerRecord.reference1 ?? null,
    creditAccount1: (DbLedgerRecord, _, context, info) =>
      ledgerCounterparty(DbLedgerRecord, { account: 'CreditAccount1' }, context, info),
    creditAccount2: (DbLedgerRecord, _, context, info) =>
      DbLedgerRecord.creditAccountID2
        ? ledgerCounterparty(DbLedgerRecord, { account: 'CreditAccount2' }, context, info)
        : null,
    debitAccount1: (DbLedgerRecord, _, context, info) =>
      ledgerCounterparty(DbLedgerRecord, { account: 'DebitAccount1' }, context, info),
    debitAccount2: (DbLedgerRecord, _, context, info) =>
      DbLedgerRecord.debitAccountID2
        ? ledgerCounterparty(DbLedgerRecord, { account: 'DebitAccount2' }, context, info)
        : null,
  },
  Charge: {
    ledgerRecords: generateLedgerRecords,
  },
  GeneratedLedgerRecords: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'LedgerRecords';
    },
  },
  LedgerCounterparty: {
    __resolveType: parent =>
      parent == null
        ? null
        : typeof parent === 'object' && 'hashavshevet_name' in parent
        ? 'TaxCategory'
        : 'NamedCounterparty',
  },
};
