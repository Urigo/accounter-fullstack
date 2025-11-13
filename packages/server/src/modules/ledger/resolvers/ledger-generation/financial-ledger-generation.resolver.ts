import { ChargesTempProvider } from '@modules/charges/providers/charges-temp.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
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
> = async (chargeId, { insertLedgerRecordsIfNotExists }, context, info) => {
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

  try {
    const charge = await context.injector
      .get(ChargesTempProvider)
      .getChargeByIdLoader.load(chargeId);
    if (!charge) {
      return {
        __typename: 'CommonError',
        message: `Charge ID="${chargeId}" not found`,
      };
    }

    if (await isChargeLocked(chargeId, context.injector, ledgerLock)) {
      return {
        __typename: 'CommonError',
        message: `Charge ID="${chargeId}" is locked for ledger generation`,
      };
    }

    let taxCategoryId = charge.tax_category_id;
    if (!taxCategoryId) {
      const taxCategory = await context.injector
        .get(TaxCategoriesProvider)
        .taxCategoryByChargeIDsLoader.load(chargeId);
      if (taxCategory?.id) {
        taxCategoryId = taxCategory.id;
      }
    }

    if (!taxCategoryId) {
      return {
        __typename: 'CommonError',
        message: `Financial charge must include tax category`,
      };
    }
    switch (taxCategoryId) {
      case exchangeRevaluationTaxCategoryId:
        return generateLedgerRecordsForExchangeRevaluation(
          chargeId,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case taxExpensesTaxCategoryId:
        return generateLedgerRecordsForTaxExpenses(
          chargeId,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case accumulatedDepreciationTaxCategoryId:
        return generateLedgerRecordsForDepreciationExpenses(
          chargeId,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case recoveryReserveTaxCategoryId:
        return generateLedgerRecordsForRecoveryReserveExpenses(
          chargeId,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case vacationReserveTaxCategoryId:
        return generateLedgerRecordsForVacationReserveExpenses(
          chargeId,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case bankDepositInterestIncomeTaxCategoryId:
        return generateLedgerRecordsForBankDepositsRevaluation(
          chargeId,
          { insertLedgerRecordsIfNotExists },
          context,
          info,
        );
      case defaultTaxCategoryId:
        return generateLedgerRecordsForBalance(
          chargeId,
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
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
