import { GraphQLError } from 'graphql';
import { generateLedgerRecordsForFinancialCharge } from '@modules/ledger/resolvers/ledger-generation/financial-ledger-generation.resolver.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { ChargeTypeEnum } from '@shared/enums';
import { getChargeType } from '../helpers/charge-type.js';
import { generateAndTagCharge } from '../helpers/financial-charge.helper.js';
import type { ChargesModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const financialChargesResolvers: ChargesModule.Resolvers = {
  Mutation: {
    generateRevaluationCharge: async (_, { date, ownerId }, context, info) => {
      const { injector, adminContext } = context;
      try {
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          adminContext.general.taxCategories.exchangeRevaluationTaxCategoryId,
          `Revaluation charge for ${date}`,
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating revaluation charge');
      }
    },
    generateBankDepositsRevaluationCharge: async (_, { date, ownerId }, context, info) => {
      const { injector, adminContext } = context;
      try {
        const { bankDepositInterestIncomeTaxCategoryId } = adminContext.bankDeposits;
        if (!bankDepositInterestIncomeTaxCategoryId) {
          throw new GraphQLError('Bank deposit interest income tax category missing');
        }
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          bankDepositInterestIncomeTaxCategoryId,
          `Bank deposits revaluation charge for ${date}`,
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating bank deposits revaluation charge');
      }
    },
    generateTaxExpensesCharge: async (_, { year, ownerId }, context, info) => {
      const {
        injector,
        adminContext: {
          authorities: { taxExpensesTaxCategoryId },
        },
      } = context;
      try {
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          taxExpensesTaxCategoryId,
          `Tax expenses charge for ${year.substring(0, 4)}`,
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating tax expenses charge');
      }
    },
    generateDepreciationCharge: async (_, { year, ownerId }, context, info) => {
      const {
        injector,
        adminContext: {
          depreciation: { accumulatedDepreciationTaxCategoryId },
        },
      } = context;
      if (!accumulatedDepreciationTaxCategoryId) {
        throw new GraphQLError('Accumulated depreciation tax category missing');
      }
      try {
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          accumulatedDepreciationTaxCategoryId,
          `Depreciation charge for ${year.substring(0, 4)}`,
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating depreciation charge');
      }
    },
    generateRecoveryReserveCharge: async (_, { year, ownerId }, context, info) => {
      const { injector, adminContext } = context;
      const { recoveryReserveTaxCategoryId } = adminContext.salaries;
      if (!recoveryReserveTaxCategoryId) {
        throw new GraphQLError('Recovery reserve tax category missing');
      }
      try {
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          recoveryReserveTaxCategoryId,
          `Recovery reserve charge for ${year.substring(0, 4)}`,
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating recovery reserve charge');
      }
    },
    generateVacationReserveCharge: async (_, { year, ownerId }, context, info) => {
      const { injector, adminContext } = context;
      const { vacationReserveTaxCategoryId } = adminContext.salaries;
      if (!vacationReserveTaxCategoryId) {
        throw new GraphQLError('Vacation reserve tax category missing');
      }

      try {
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          vacationReserveTaxCategoryId,
          `Vacation reserves charge for ${year.substring(0, 4)}`,
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating vacation reserves charge');
      }
    },
    generateBalanceCharge: async (_, { description, balanceRecords }, context, info) => {
      const { injector, adminContext } = context;

      if (!balanceRecords.length) {
        throw new GraphQLError('Balance charge must include balance records');
      }

      const { defaultTaxCategoryId, defaultAdminBusinessId } = adminContext;
      if (!defaultTaxCategoryId) {
        throw new GraphQLError('Default tax category missing');
      }

      try {
        const charge = await generateAndTagCharge(
          injector,
          defaultAdminBusinessId,
          defaultTaxCategoryId,
          description,
        );

        await Promise.all(
          balanceRecords.map(async record => {
            if (!record.debtorId && !record.creditorId) {
              throw new GraphQLError(
                'Balance record must include at least one counterparty (debtor or creditor)',
              );
            }
            await injector
              .get(MiscExpensesProvider)
              .insertExpense({ ...record, chargeId: charge.id })
              .catch(() => {
                throw new GraphQLError('Error adding balance records');
              });
          }),
        );

        await generateLedgerRecordsForFinancialCharge(
          charge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return charge;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Error generating balance charge');
      }
    },
  },
  FinancialCharge: {
    __isTypeOf: (DbCharge, context) =>
      getChargeType(DbCharge, context) === ChargeTypeEnum.Financial,
    ...commonChargeFields,
    vat: () => null,
    totalAmount: () => null,
    property: () => false,
    conversion: () => false,
    salary: () => false,
    isInvoicePaymentDifferentCurrency: () => false,
    minEventDate: DbCharge => DbCharge.ledger_min_invoice_date,
    minDebitDate: DbCharge => DbCharge.ledger_min_value_date,
    // minDocumentsDate:
    // validationData:
    // metadata:
    yearsOfRelevance: () => null,
  },
};
