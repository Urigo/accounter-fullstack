import { TAX_EXPENSES_TAX_CATEGORY_ID } from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
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
  try {
    if (!charge.tax_category_id) {
      return {
        __typename: 'CommonError',
        message: `Financial charge must include tax category`,
      };
    }
    const { depreciation, salaries, bankDeposits } = context.adminContext;
    switch (charge.tax_category_id) {
      case context.adminContext.general.taxCategories.exchangeRevaluationTaxCategoryId:
        return generateLedgerRecordsForExchangeRevaluation(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case TAX_EXPENSES_TAX_CATEGORY_ID:
        return generateLedgerRecordsForTaxExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case depreciation.accumulatedDepreciationTaxCategoryId:
        return generateLedgerRecordsForDepreciationExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case salaries.recoveryReserveTaxCategoryId:
        return generateLedgerRecordsForRecoveryReserveExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case salaries.vacationReserveTaxCategoryId:
        return generateLedgerRecordsForVacationReserveExpenses(
          charge,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case bankDeposits.bankDepositInterestIncomeTaxCategoryId:
        return generateLedgerRecordsForBankDepositsRevaluation(
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
