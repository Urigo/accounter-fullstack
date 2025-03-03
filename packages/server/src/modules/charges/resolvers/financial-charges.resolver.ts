import { GraphQLError } from 'graphql';
import { generateLedgerRecordsForFinancialCharge } from '@modules/ledger/resolvers/ledger-generation/financial-ledger-generation.resolver.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { ChargeTypeEnum } from '@shared/enums';
import { getChargeType } from '../helpers/charge-type.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule } from '../types.js';
import { commonChargeFields } from './common.js';

export const financialChargesResolvers: ChargesModule.Resolvers = {
  Mutation: {
    generateRevaluationCharge: async (_, { date, ownerId }, context, info) => {
      const { injector, adminContext } = context;
      try {
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: `Revaluation charge for ${date}`,
          type: 'FINANCIAL',
          taxCategoryId: adminContext.general.taxCategories.exchangeRevaluationTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        await generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return newExtendedCharge;
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
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: `Bank deposits revaluation charge for ${date}`,
          type: 'FINANCIAL',
          taxCategoryId: bankDepositInterestIncomeTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        await generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        return newExtendedCharge;
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
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: `Tax expenses charge for ${year.substring(0, 4)}`,
          type: 'FINANCIAL',
          taxCategoryId: taxExpensesTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        const tagName = 'financial';

        const addTagPromise = async () => {
          const tag = await injector
            .get(TagsProvider)
            .getTagByNameLoader.load(tagName)
            .catch(() => {
              throw new GraphQLError(`Error adding "${tagName}" tag`);
            });

          if (!tag) {
            throw new GraphQLError(`"${tagName}" tag not found`);
          }

          await injector
            .get(ChargeTagsProvider)
            .insertChargeTag({ chargeId: newExtendedCharge.id, tagId: tag.id })
            .catch(() => {
              throw new GraphQLError(
                `Error adding "${tagName}" tag to charge ID="${newExtendedCharge.id}"`,
              );
            });
        };

        const generateLedgerPromise = generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        await Promise.all([addTagPromise(), generateLedgerPromise]);

        return newExtendedCharge;
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
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: `Depreciation charge for ${year.substring(0, 4)}`,
          type: 'FINANCIAL',
          taxCategoryId: accumulatedDepreciationTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        const tagName = 'financial';

        const addTagPromise = async () => {
          const tag = await injector
            .get(TagsProvider)
            .getTagByNameLoader.load(tagName)
            .catch(() => {
              throw new GraphQLError(`Error adding "${tagName}" tag`);
            });

          if (!tag) {
            throw new GraphQLError(`"${tagName}" tag not found`);
          }

          await injector
            .get(ChargeTagsProvider)
            .insertChargeTag({ chargeId: newExtendedCharge.id, tagId: tag.id })
            .catch(() => {
              throw new GraphQLError(
                `Error adding "${tagName}" tag to charge ID="${newExtendedCharge.id}"`,
              );
            });
        };

        const generateLedgerPromise = generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        await Promise.all([addTagPromise(), generateLedgerPromise]);

        return newExtendedCharge;
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
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: `Recovery reserve charge for ${year.substring(0, 4)}`,
          type: 'FINANCIAL',
          taxCategoryId: recoveryReserveTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        const tagName = 'financial';

        const addTagPromise = async () => {
          const tag = await injector
            .get(TagsProvider)
            .getTagByNameLoader.load(tagName)
            .catch(() => {
              throw new GraphQLError(`Error adding "${tagName}" tag`);
            });

          if (!tag) {
            throw new GraphQLError(`"${tagName}" tag not found`);
          }

          await injector
            .get(ChargeTagsProvider)
            .insertChargeTag({ chargeId: newExtendedCharge.id, tagId: tag.id })
            .catch(() => {
              throw new GraphQLError(
                `Error adding "${tagName}" tag to charge ID="${newExtendedCharge.id}"`,
              );
            });
        };

        const generateLedgerPromise = generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        await Promise.all([addTagPromise(), generateLedgerPromise]);

        return newExtendedCharge;
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
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: `Vacation reserves charge for ${year.substring(0, 4)}`,
          type: 'FINANCIAL',
          taxCategoryId: vacationReserveTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        const tagName = 'financial';

        const addTagPromise = async () => {
          const tag = await injector
            .get(TagsProvider)
            .getTagByNameLoader.load(tagName)
            .catch(() => {
              throw new GraphQLError(`Error adding "${tagName}" tag`);
            });

          if (!tag) {
            throw new GraphQLError(`"${tagName}" tag not found`);
          }

          await injector
            .get(ChargeTagsProvider)
            .insertChargeTag({ chargeId: newExtendedCharge.id, tagId: tag.id })
            .catch(() => {
              throw new GraphQLError(
                `Error adding "${tagName}" tag to charge ID="${newExtendedCharge.id}"`,
              );
            });
        };

        const generateLedgerPromise = generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        await Promise.all([addTagPromise(), generateLedgerPromise]);

        return newExtendedCharge;
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

      const { defaultTaxCategoryId } = adminContext;
      if (!defaultTaxCategoryId) {
        throw new GraphQLError('Default tax category missing');
      }

      try {
        const [charge] = await injector.get(ChargesProvider).generateCharge({
          ownerId: adminContext.defaultAdminBusinessId,
          userDescription: description,
          type: 'FINANCIAL',
          taxCategoryId: defaultTaxCategoryId,
        });

        if (!charge) {
          throw new Error('Error creating new charge');
        }

        const newExtendedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(charge.id);

        if (!newExtendedCharge) {
          throw new Error('Error creating new charge');
        }

        const tagName = 'financial';

        const addTagPromise = async () => {
          const tag = await injector
            .get(TagsProvider)
            .getTagByNameLoader.load(tagName)
            .catch(() => {
              throw new GraphQLError(`Error adding "${tagName}" tag`);
            });

          if (!tag) {
            throw new GraphQLError(`"${tagName}" tag not found`);
          }

          await injector
            .get(ChargeTagsProvider)
            .insertChargeTag({ chargeId: newExtendedCharge.id, tagId: tag.id })
            .catch(() => {
              throw new GraphQLError(
                `Error adding "${tagName}" tag to charge ID="${newExtendedCharge.id}"`,
              );
            });
        };

        const addBalanceRecordsPromises: Array<Promise<void>> = balanceRecords.map(async record => {
          if (!record.debtorId && !record.creditorId) {
            throw new GraphQLError(
              'Balance record must include at least one counterparty (debtor or creditor)',
            );
          }
          await injector
            .get(MiscExpensesProvider)
            .insertExpense({ ...record, chargeId: newExtendedCharge.id })
            .catch(() => {
              throw new GraphQLError('Error adding balance records');
            });
        });

        const generateLedgerPromise = generateLedgerRecordsForFinancialCharge(
          newExtendedCharge,
          { insertLedgerRecordsIfNotExists: true },
          context,
          info,
        );

        await Promise.all([addTagPromise(), ...addBalanceRecordsPromises, generateLedgerPromise]);

        return newExtendedCharge;
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
