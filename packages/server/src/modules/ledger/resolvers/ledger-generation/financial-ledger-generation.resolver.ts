import { isChargeLocked } from '@modules/ledger/helpers/ledger-lock.js';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { generateLedgerRecordsForBalance } from './financial-ledger-generation/balance-ledger-generation.resolver.js';
import { generateLedgerRecordsForBankDepositsRevaluation } from './financial-ledger-generation/bank-deposits-revaluation-ledger-generation.resolver.js';
import { generateLedgerRecordsForDepreciationExpenses } from './financial-ledger-generation/depreciation-expenses-ledger-generation.resolver.js';
import { generateLedgerRecordsForRecoveryReserveExpenses } from './financial-ledger-generation/recovery-reserve-ledger-generation.resolver.js';
import { generateLedgerRecordsForExchangeRevaluation } from './financial-ledger-generation/revaluation-ledger-generation.resolver.js';
import { generateLedgerRecordsForTaxExpenses } from './financial-ledger-generation/tax-expenses-ledger-generation.resolver.js';
import { generateLedgerRecordsForVacationReserveExpenses } from './financial-ledger-generation/vacation-reserve-ledger-generation.resolver.js';

export const REVALUATION_LEDGER_DESCRIPTION = 'Revaluation of account';

export const generateLedgerRecordsForFinancialCharge: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context, info) => {
  const {
    adminContext: {
      defaultTaxCategoryId,
      ledgerLock,
      authorities: { taxExpensesTaxCategoryId },
      bankDeposits: { bankDepositInterestIncomeTaxCategoryId },
      depreciation: { accumulatedDepreciationTaxCategoryId },
      general: {
        taxCategories: { exchangeRevaluationTaxCategoryId },
      },
      salaries: { recoveryReserveTaxCategoryId, vacationReserveTaxCategoryId },
    },
  } = context;

  if (isChargeLocked(charge, ledgerLock)) {
    return {
      __typename: 'CommonError',
      message: `Charge ID="${charge.id}" is locked for ledger generation`,
    };
  }

  try {
    if (!charge.tax_category_id) {
      return {
        __typename: 'CommonError',
        message: `Financial charge must include tax category`,
      };
    }
    switch (charge.tax_category_id) {
      case exchangeRevaluationTaxCategoryId:
        return generateLedgerRecordsForExchangeRevaluation(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case taxExpensesTaxCategoryId:
        return generateLedgerRecordsForTaxExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case accumulatedDepreciationTaxCategoryId:
        return generateLedgerRecordsForDepreciationExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case recoveryReserveTaxCategoryId:
        return generateLedgerRecordsForRecoveryReserveExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case vacationReserveTaxCategoryId:
        return generateLedgerRecordsForVacationReserveExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case bankDepositInterestIncomeTaxCategoryId:
        return generateLedgerRecordsForBankDepositsRevaluation(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case defaultTaxCategoryId:
        return generateLedgerRecordsForBalance(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      default:
        return {
          __typename: 'CommonError',
          message: `Unsupported tax category for financial charge`,
        };
    }
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${charge.id}"\n${e}`,
    };
  }
};
