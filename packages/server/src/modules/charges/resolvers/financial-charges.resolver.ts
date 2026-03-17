import { GraphQLError } from 'graphql';
import { ChargeTypeEnum } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getMinDate } from '../../ledger/helpers/ledger-lock.js';
import { generateLedgerRecordsForFinancialCharge } from '../../ledger/resolvers/ledger-generation/financial-ledger-generation.resolver.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { getChargeType } from '../helpers/charge-type.js';
import { getChargeLedgerMeta } from '../helpers/common.helper.js';
import { generateAndTagCharge } from '../helpers/financial-charge.helper.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const financialChargesResolvers: ChargesModule.Resolvers = {
  Query: {
    annualFinancialCharges: async (_, { ownerId, year }, { injector }) => {
      const adminContext = await injector.get(AdminContextProvider).getVerifiedAdminContext();

      const charges = await injector.get(ChargesProvider).getChargesByFilters({
        ownerIds: [ownerId ?? adminContext.ownerId],
        type: 'FINANCIAL',
        fromAnyDate: year,
        toAnyDate: year,
      });

      return {
        id: `${year}-financial-charges`,
        revaluationCharge: charges.find(c =>
          c.business_array?.includes(
            adminContext.general.taxCategories.exchangeRevaluationTaxCategoryId,
          ),
        ),
        taxExpensesCharge: charges.find(c =>
          c.business_array?.includes(adminContext.authorities.taxExpensesTaxCategoryId),
        ),
        depreciationCharge: adminContext.depreciation.accumulatedDepreciationTaxCategoryId
          ? charges.find(c =>
              c.business_array?.includes(
                adminContext.depreciation.accumulatedDepreciationTaxCategoryId!,
              ),
            )
          : null,
        recoveryReserveCharge: adminContext.salaries.recoveryReserveTaxCategoryId
          ? charges.find(c =>
              c.business_array?.includes(adminContext.salaries.recoveryReserveTaxCategoryId!),
            )
          : null,
        vacationReserveCharge: adminContext.salaries.vacationReserveTaxCategoryId
          ? charges.find(c =>
              c.business_array?.includes(adminContext.salaries.vacationReserveTaxCategoryId!),
            )
          : null,
        bankDepositsRevaluationCharge: adminContext.bankDeposits
          .bankDepositInterestIncomeTaxCategoryId
          ? charges.find(c =>
              c.business_array?.includes(adminContext.bankDeposits.bankDepositBusinessId!),
            )
          : null,
      };
    },
  },
  Mutation: {
    generateRevaluationCharge: async (_, { date, ownerId }, context, info) => {
      const { injector } = context;
      const {
        ledgerLock,
        general: {
          taxCategories: { exchangeRevaluationTaxCategoryId },
        },
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (ledgerLock && date <= ledgerLock) {
        throw new GraphQLError('Cannot generate revaluation charge for locked period');
      }
      try {
        const charge = await generateAndTagCharge(
          injector,
          ownerId,
          exchangeRevaluationTaxCategoryId,
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
        throw errorSimplifier('Error generating revaluation charge', e);
      }
    },
    generateBankDepositsRevaluationCharge: async (_, { date, ownerId }, context, info) => {
      const { injector } = context;
      const {
        ledgerLock,
        bankDeposits: { bankDepositInterestIncomeTaxCategoryId },
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (ledgerLock && date <= ledgerLock) {
        throw new GraphQLError('Cannot generate revaluation charge for locked period');
      }
      try {
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
        throw errorSimplifier('Error generating bank deposits revaluation charge', e);
      }
    },
    generateTaxExpensesCharge: async (_, { year, ownerId }, context, info) => {
      const { injector } = context;
      const {
        ledgerLock,
        authorities: { taxExpensesTaxCategoryId },
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (ledgerLock && `${year}-12-31` <= ledgerLock) {
        throw new GraphQLError('Cannot generate revaluation charge for locked period');
      }
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
        throw errorSimplifier('Error generating tax expenses charge', e);
      }
    },
    generateDepreciationCharge: async (_, { year, ownerId }, context, info) => {
      const { injector } = context;
      const {
        ledgerLock,
        depreciation: { accumulatedDepreciationTaxCategoryId },
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (ledgerLock && `${year}-12-31` <= ledgerLock) {
        throw new GraphQLError('Cannot generate revaluation charge for locked period');
      }
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
        throw errorSimplifier('Error generating depreciation charge', e);
      }
    },
    generateRecoveryReserveCharge: async (_, { year, ownerId }, context, info) => {
      const { injector } = context;
      const {
        ledgerLock,
        salaries: { recoveryReserveTaxCategoryId },
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (ledgerLock && `${year}-12-31` <= ledgerLock) {
        throw new GraphQLError('Cannot generate revaluation charge for locked period');
      }
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
        throw errorSimplifier('Error generating recovery reserve charge', e);
      }
    },
    generateVacationReserveCharge: async (_, { year, ownerId }, context, info) => {
      const { injector } = context;
      const {
        ledgerLock,
        salaries: { vacationReserveTaxCategoryId },
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      if (ledgerLock && `${year}-12-31` <= ledgerLock) {
        throw new GraphQLError('Cannot generate revaluation charge for locked period');
      }
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
        throw errorSimplifier('Error generating vacation reserves charge', e);
      }
    },
    generateBalanceCharge: async (_, { description, balanceRecords }, context, info) => {
      const { injector } = context;

      if (!balanceRecords.length) {
        throw new GraphQLError('Balance charge must include balance records');
      }
      const { defaultTaxCategoryId, ownerId, ledgerLock } = await injector
        .get(AdminContextProvider)
        .getVerifiedAdminContext();

      if (!defaultTaxCategoryId) {
        throw new GraphQLError('Default tax category missing');
      }

      try {
        if (ledgerLock) {
          const minDate = getMinDate(
            balanceRecords.map(record => [new Date(record.invoiceDate), record.valueDate]).flat(),
          );
          if (minDate && dateToTimelessDateString(minDate) <= ledgerLock) {
            throw new GraphQLError('Cannot generate balance charge for locked period');
          }
        }

        const charge = await generateAndTagCharge(
          injector,
          ownerId,
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
        throw errorSimplifier('Error generating balance charge', e);
      }
    },
  },
  FinancialCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      (await getChargeType(DbCharge, injector).catch(error => {
        throw errorSimplifier('Failed to determine charge type', error);
      })) === ChargeTypeEnum.Financial,
    ...commonChargeFields,
    type: () => 'FINANCIAL',
    vat: () => null,
    totalAmount: () => null,
    property: () => false,
    isInvoicePaymentDifferentCurrency: () => false,
    minEventDate: async (DbCharge, _, { injector }) => {
      try {
        const { ledgerMinInvoiceDate } = await getChargeLedgerMeta(DbCharge.id, injector);
        return ledgerMinInvoiceDate;
      } catch (error) {
        throw errorSimplifier('Failed to fetch min event date', error);
      }
    },
    minDebitDate: async (DbCharge, _, { injector }) => {
      try {
        const { ledgerMinValueDate } = await getChargeLedgerMeta(DbCharge.id, injector);
        return ledgerMinValueDate;
      } catch (error) {
        throw errorSimplifier('Failed to fetch min debit date', error);
      }
    },
    // minDocumentsDate:
    // validationData:
    // metadata:
    yearsOfRelevance: () => null,
  },
};
