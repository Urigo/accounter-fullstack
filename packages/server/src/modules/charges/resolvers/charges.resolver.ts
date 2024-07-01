import { GraphQLError } from 'graphql';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { ledgerGenerationByCharge } from '@modules/ledger/helpers/ledger-by-charge-type.helper.js';
import { ledgerRecordsGenerationFullMatchComparison } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import { ChargeSortByField, ChargeTypeEnum } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { getChargeType } from '../helpers/charge-type.js';
import { deleteCharges } from '../helpers/delete-charges.helper.js';
import { mergeChargesExecutor } from '../helpers/merge-charges.hepler.js';
import { ChargeRequiredWrapper, ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IGetChargesByIdsResult, IUpdateChargeParams } from '../types.js';
import {
  commonChargeFields,
  commonDocumentsFields,
  commonFinancialAccountFields,
  commonFinancialEntityFields,
} from './common.js';

export const chargesResolvers: ChargesModule.Resolvers &
  Pick<Resolvers, 'UpdateChargeResult' | 'MergeChargeResult'> = {
  Query: {
    chargesByIDs: async (_, { chargeIDs }, { injector }) => {
      if (chargeIDs.length === 0) {
        return [];
      }

      const dbCharges = await injector.get(ChargesProvider).getChargeByIdLoader.loadMany(chargeIDs);
      if (!dbCharges) {
        if (chargeIDs.length === 1) {
          throw new GraphQLError(`Charge ID="${chargeIDs[0]}" not found`);
        } else {
          throw new GraphQLError(`Couldn't find any charges`);
        }
      }

      const charges = chargeIDs.map(id => {
        const charge = dbCharges.find(charge => charge && 'id' in charge && charge.id === id);
        if (!charge) {
          throw new GraphQLError(`Charge ID="${id}" not found`);
        }
        return charge as ChargeRequiredWrapper<IGetChargesByIdsResult>;
      });
      return charges;
    },
    allCharges: async (_, { filters, page, limit }, { injector }) => {
      // handle sort column
      let sortColumn: 'event_date' | 'event_amount' | 'abs_event_amount' = 'event_date';
      switch (filters?.sortBy?.field) {
        case ChargeSortByField.Amount:
          sortColumn = 'event_amount';
          break;
        case ChargeSortByField.AbsAmount:
          sortColumn = 'abs_event_amount';
          break;
        case ChargeSortByField.Date:
          sortColumn = 'event_date';
          break;
      }

      const charges = await injector
        .get(ChargesProvider)
        .getChargesByFilters({
          ownerIds: filters?.byOwners,
          fromDate: filters?.fromDate,
          toDate: filters?.toDate,
          fromAnyDate: filters?.fromAnyDate,
          toAnyDate: filters?.toAnyDate,
          sortColumn,
          asc: filters?.sortBy?.asc !== false,
          chargeType: filters?.chargesType,
          businessIds: filters?.byBusinesses,
          withoutInvoice: filters?.withoutInvoice,
          withoutDocuments: filters?.withoutDocuments,
          withoutLedger: filters?.withoutLedger,
          tags: filters?.byTags,
          accountantApproval: filters?.accountantApproval,
        })
        .catch(e => {
          throw new Error(e.message);
        });

      const pageCharges = charges.slice(page * limit - limit, page * limit);

      return {
        __typename: 'PaginatedCharges',
        nodes: pageCharges,
        pageInfo: {
          totalPages: Math.ceil(charges.length / limit),
        },
      };
    },
  },
  Mutation: {
    updateCharge: async (_, { chargeId, fields }, { injector }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountantReviewed: fields.accountantApproval,
        type: fields.isConversion ? 'PAYROLL' : undefined,
        isProperty: fields.isProperty,
        isInvoicePaymentDifferentCurrency: fields.isInvoicePaymentDifferentCurrency,
        ownerId: fields.ownerId,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
        yearsOfRelevance: fields.yearsOfRelevance as IUpdateChargeParams['yearsOfRelevance'],
        chargeId,
      };
      try {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(chargeId);
        const res = await injector.get(ChargesProvider).updateCharge({ ...adjustedFields });
        const updatedCharge = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.load(res[0].id);
        if (!updatedCharge) {
          throw new Error(`Charge ID="${chargeId}" not found`);
        }

        // handle tags
        if (fields?.tags) {
          const newTagIDs = fields.tags.map(t => t.id);
          const pastTags = await injector
            .get(ChargeTagsProvider)
            .getTagsByChargeIDLoader.load(chargeId)
            .then(res => res.map(tag => tag.id!));
          // clear removed tags
          const tagsToRemove = pastTags.filter(tagId => !newTagIDs.includes(tagId));
          if (tagsToRemove.length) {
            await injector
              .get(ChargeTagsProvider)
              .clearChargeTags({ chargeId, tagIDs: tagsToRemove });
          }
          // add new tags
          const tagIDsToAdd = newTagIDs.filter(tagId => !pastTags.includes(tagId));
          for (const tagId of tagIDsToAdd) {
            await injector
              .get(ChargeTagsProvider)
              .insertChargeTag({ chargeId, tagId })
              .catch(() => {
                throw new GraphQLError(`Error adding tag ID="${tagId}" to charge ID="${chargeId}"`);
              });
          }
        }

        // handle business trip
        if (fields?.businessTripID) {
          await injector
            .get(BusinessTripsProvider)
            .updateChargeBusinessTrip(
              chargeId,
              fields.businessTripID === EMPTY_UUID ? null : fields.businessTripID,
            )
            .catch(() => {
              throw new GraphQLError(`Error updating business trip for charge ID="${chargeId}"`);
            });
        }

        return { charge: updatedCharge };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message:
            (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        };
      }
    },
    mergeCharges: async (_, { baseChargeID, chargeIdsToMerge, fields }, { injector }) => {
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(baseChargeID);
        if (!charge) {
          throw new Error(`Charge not found`);
        }

        if (fields) {
          const adjustedFields: IUpdateChargeParams = {
            accountantReviewed: fields?.accountantApproval,
            type: fields?.isConversion ? 'PAYROLL' : undefined,
            isProperty: fields?.isProperty,
            isInvoicePaymentDifferentCurrency: fields?.isInvoicePaymentDifferentCurrency,
            ownerId: fields?.ownerId,
            userDescription: fields?.userDescription,
            chargeId: baseChargeID,
          };
          injector.get(ChargesProvider).getChargeByIdLoader.clear(baseChargeID);
          await injector
            .get(ChargesProvider)
            .updateCharge({ ...adjustedFields })
            .catch(e => {
              throw new Error(
                `Failed to update charge:\n${
                  (e as Error)?.message ??
                  (e as { errors: Error[] })?.errors.map(e => e.message).toString()
                }`,
              );
            });
        }

        await mergeChargesExecutor(chargeIdsToMerge, baseChargeID, injector);

        return { charge };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message:
            (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        };
      }
    },
    deleteCharge: async (_, { chargeId }, { injector }) => {
      const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
      if (!charge) {
        throw new GraphQLError(`Charge ID="${chargeId}" not found`);
      }
      if (Number(charge.documents_count ?? 0) > 0 || Number(charge.transactions_count ?? 0) > 0) {
        throw new GraphQLError(`Charge ID="${chargeId}" has linked documents/transactions`);
      }

      await deleteCharges([chargeId], injector);
      return true;
    },
  },
  UpdateChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'UpdateChargeSuccessfulResult';
    },
  },
  MergeChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'MergeChargeSuccessfulResult';
    },
  },
  CommonCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.Common,
    ...commonChargeFields,
  },
  ConversionCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.Conversion,
    ...commonChargeFields,
  },
  SalaryCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.Salary,
    ...commonChargeFields,
  },
  InternalTransferCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.InternalTransfer,
    ...commonChargeFields,
  },
  DividendCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.Dividend,
    ...commonChargeFields,
  },
  BusinessTripCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.BusinessTrip,
    ...commonChargeFields,
  },
  MonthlyVatCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.MonthlyVat,
    ...commonChargeFields,
  },
  BankDepositCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.BankDeposit,
    ...commonChargeFields,
  },
  CreditcardBankCharge: {
    __isTypeOf: DbCharge => getChargeType(DbCharge) === ChargeTypeEnum.CreditcardBankCharge,
    ...commonChargeFields,
  },
  Invoice: {
    ...commonDocumentsFields,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
  },
  CreditInvoice: {
    ...commonDocumentsFields,
  },
  Proforma: {
    ...commonDocumentsFields,
  },
  Unprocessed: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
  },
  BankFinancialAccount: {
    ...commonFinancialAccountFields,
  },
  CardFinancialAccount: {
    ...commonFinancialAccountFields,
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  ChargeMetadata: {
    createdAt: DbCharge => DbCharge.created_at,
    updatedAt: DbCharge => DbCharge.updated_at,
    invoicesCount: DbCharge => Number(DbCharge.invoices_count) ?? 0,
    receiptsCount: DbCharge => Number(DbCharge.receipts_count) ?? 0,
    documentsCount: DbCharge => Number(DbCharge.documents_count) ?? 0,
    invalidDocuments: DbCharge => DbCharge.invalid_documents ?? true,
    transactionsCount: DbCharge => {
      return Number(DbCharge.transactions_count) ?? 0;
    },
    invalidTransactions: DbCharge => DbCharge.invalid_transactions ?? true,
    ledgerCount: DbCharge => Number(DbCharge.ledger_count) ?? 0,
    invalidLedger: async (DbCharge, _, context, info) => {
      try {
        const generatedledgerPromise = ledgerGenerationByCharge(DbCharge)(
          DbCharge,
          { insertLedgerRecordsIfNotExists: false },
          context,
          info,
        );

        const currentRecordPromise = context.injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(DbCharge.id);

        const [currentRecord, generated] = await Promise.all([
          currentRecordPromise,
          generatedledgerPromise,
        ]);

        if (
          !generated ||
          'message' in generated ||
          generated.balance?.isBalanced === false ||
          generated.errors?.length > 0
        ) {
          return 'INVALID';
        }

        const fullMatching = ledgerRecordsGenerationFullMatchComparison(
          currentRecord,
          generated.records,
        );

        return fullMatching.isFullyMatched ? 'VALID' : 'DIFF';
      } catch (err) {
        return 'INVALID';
      }
    },
    optionalBusinesses: DbCharge =>
      DbCharge.business_array && DbCharge.business_array.length > 1 ? DbCharge.business_array : [],
    isSalary: DbCharge => DbCharge.type === 'PAYROLL' ?? false,
  },
};
