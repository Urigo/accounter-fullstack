import { Currency, Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import type { LedgerModule } from '../types.js';
import { generateLedgerRecordsForBusinessTrip } from './business-trip-ledger-generation.resolver.js';
import { generateLedgerRecordsForCommonCharge } from './common-ledger-generation.resolver.js';
import { generateLedgerRecordsForConversion } from './conversion-ledger-generation.resolver.js';
import { generateLedgerRecordsForDividend } from './dividend-ledger-generation.resolver.js';
import { generateLedgerRecordsForInternalTransfer } from './internal-transfer-ledger-generation.resolver.js';
import { generateLedgerRecordsForMonthlyVat } from './monthly-vat-ledger-generation.resolver.js';
import { generateLedgerRecordsForSalary } from './salary-ledger-generation.resolver.js';

export const ledgerResolvers: LedgerModule.Resolvers & Pick<Resolvers, 'GeneratedLedgerRecords'> = {
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
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
  },
  CommonCharge: {
    ledgerRecords: generateLedgerRecordsForCommonCharge,
  },
  ConversionCharge: {
    ledgerRecords: generateLedgerRecordsForConversion,
  },
  SalaryCharge: {
    ledgerRecords: generateLedgerRecordsForSalary,
  },
  InternalTransferCharge: {
    ledgerRecords: generateLedgerRecordsForInternalTransfer,
  },
  DividendCharge: {
    ledgerRecords: generateLedgerRecordsForDividend,
  },
  BusinessTripCharge: {
    ledgerRecords: generateLedgerRecordsForBusinessTrip,
  },
  MonthlyVatCharge: {
    ledgerRecords: generateLedgerRecordsForMonthlyVat,
  },
  GeneratedLedgerRecords: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'LedgerRecords';
    },
  },
};
