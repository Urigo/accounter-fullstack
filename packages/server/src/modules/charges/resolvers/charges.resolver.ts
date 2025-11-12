import { GraphQLError } from 'graphql';
import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { ledgerGenerationByCharge } from '@modules/ledger/helpers/ledger-by-charge-type.helper.js';
import { isChargeLocked } from '@modules/ledger/helpers/ledger-lock.js';
import { ledgerRecordsGenerationFullMatchComparison } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import { ChargeSortByField, ChargeTypeEnum, DocumentType } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import {
  batchUpdateChargesBusinessTrip,
  batchUpdateChargesTags,
  batchUpdateChargesYearsSpread,
} from '../helpers/batch-update-charges.js';
import { getChargeType } from '../helpers/charge-type.js';
import { deleteCharges } from '../helpers/delete-charges.helper.js';
import { mergeChargesExecutor } from '../helpers/merge-charges.hepler.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type {
  accountant_statusArray,
  ChargesModule,
  IBatchUpdateChargesParams,
  IUpdateChargeParams,
} from '../types.js';
import { commonChargeFields, commonDocumentsFields, safeGetChargeById } from './common.js';

export const chargesResolvers: ChargesModule.Resolvers &
  Pick<Resolvers, 'UpdateChargeResult' | 'MergeChargeResult' | 'BatchUpdateChargesResult'> = {
  Query: {
    charge: (_, { chargeId }) => chargeId,
    chargesByIDs: (_, { chargeIDs }) => chargeIDs,
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
          fromAnyDate: filters?.fromAnyDate,
          toAnyDate: filters?.toAnyDate,
          sortColumn,
          asc: filters?.sortBy?.asc !== false,
          chargeType: filters?.chargesType,
          businessIds: filters?.byBusinesses,
          withoutInvoice: filters?.withoutInvoice,
          withoutReceipt: filters?.withoutReceipt,
          withoutDocuments: filters?.withoutDocuments,
          withOpenDocuments: filters?.withOpenDocuments,
          withoutTransactions: filters?.withoutTransactions,
          withoutLedger: filters?.withoutLedger,
          tags: filters?.byTags,
          accountantStatuses: filters?.accountantStatus as accountant_statusArray | undefined,
        })
        .catch(e => {
          const message = 'Error fetching charges';
          console.error(`${message}: ${e}`);
          if (e instanceof GraphQLError) {
            throw e;
          }
          throw new GraphQLError(message);
        });

      const pageCharges = charges.slice(page * limit, (page + 1) * limit);

      return {
        __typename: 'PaginatedCharges',
        nodes: pageCharges.map(charge => charge.id),
        pageInfo: {
          totalPages: Math.ceil(charges.length / limit),
          totalRecords: charges.length,
        },
      };
    },
    chargesWithMissingRequiredInfo: async (_, { page, limit }, { injector, adminContext }) => {
      const chargeIds = new Set<string>();
      // get by transactions
      const getByTransactionsPromise = injector
        .get(TransactionsProvider)
        .getTransactionsByMissingRequiredInfo()
        .then(transactions => {
          transactions.map(transaction => {
            if (transaction.charge_id) {
              chargeIds.add(transaction.charge_id);
            }
          });
        });

      // get by documents
      const getByDocumentsPromise = injector
        .get(DocumentsProvider)
        .getDocumentsByMissingRequiredInfo()
        .then(documents => {
          documents.map(document => {
            if (document.charge_id) {
              chargeIds.add(document.charge_id);
            }
          });
        });

      // get by charge
      const getByChargesPromise = injector
        .get(ChargesProvider)
        .getChargesByMissingRequiredInfo()
        .then(charges => {
          charges.map(charge => {
            if (charge.id) {
              chargeIds.add(charge.id);
            }
          });
        });

      await Promise.all([getByTransactionsPromise, getByDocumentsPromise, getByChargesPromise]);

      const charges = await Promise.all(
        Array.from(chargeIds).map(
          async id =>
            await injector
              .get(ChargesProvider)
              .getChargeByIdLoader.load(id)
              .then(charge => {
                if (!charge) {
                  throw new GraphQLError(`Charge ID="${id}" not found`);
                }
                return charge;
              })
              .catch(e => {
                const message = `Error loading charge ID="${id}"`;
                console.error(`${message}: ${e}`);
                throw new GraphQLError(message);
              }),
        ),
      );

      const pageCharges = charges
        .filter(charge => charge.owner_id === adminContext.defaultAdminBusinessId)
        .sort((chargeA, chargeB) => {
          const dateA =
            (
              chargeA.documents_min_date ||
              chargeA.transactions_min_debit_date ||
              chargeA.transactions_min_event_date ||
              chargeA.ledger_min_value_date ||
              chargeA.ledger_min_invoice_date
            )?.getTime() ?? 0;
          const dateB =
            (
              chargeB.documents_min_date ||
              chargeB.transactions_min_debit_date ||
              chargeB.transactions_min_event_date ||
              chargeB.ledger_min_value_date ||
              chargeB.ledger_min_invoice_date
            )?.getTime() ?? 0;

          if (dateA > dateB) {
            return -1;
          }
          if (dateA < dateB) {
            return 1;
          }

          return chargeA.id.localeCompare(chargeB.id);
        })
        .slice(page * limit - limit, page * limit);

      return {
        __typename: 'PaginatedCharges',
        nodes: pageCharges.map(charge => charge.id),
        pageInfo: {
          totalPages: Math.ceil(charges.length / limit),
          totalRecords: charges.length,
        },
      };
    },
  },
  Mutation: {
    updateCharge: async (_, { chargeId, fields }, { injector }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountantStatus: fields.accountantApproval,
        type: fields.isConversion ? 'CONVERSION' : undefined,
        isProperty: fields.isProperty,
        isInvoicePaymentDifferentCurrency: fields.isInvoicePaymentDifferentCurrency,
        ownerId: fields.ownerId,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
        optionalVAT: fields.optionalVAT,
        optionalDocuments: fields.optionalDocuments,
        chargeId,
      };
      try {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(chargeId);
        await injector
          .get(ChargesProvider)
          .updateCharge({ ...adjustedFields })
          .catch(e => {
            console.error(e);
            throw new GraphQLError(`Error updating charge ID="${chargeId}"`);
          });

        const indirectUpdatesPromises: Array<Promise<unknown>> = [];

        // handle tags
        if (fields?.tags) {
          const newTagIDs = fields.tags.map(t => t.id);
          const updateTagsPromise = async () => {
            const tagsPromises: Array<Promise<unknown>> = [];
            const pastTags = await injector
              .get(ChargeTagsProvider)
              .getTagsByChargeIDLoader.load(chargeId)
              .then(res => res.map(tag => tag.id!));
            // clear removed tags
            const tagsToRemove = pastTags.filter(tagId => !newTagIDs.includes(tagId));
            if (tagsToRemove.length) {
              tagsPromises.push(
                injector
                  .get(ChargeTagsProvider)
                  .clearChargeTags({ chargeId, tagIDs: tagsToRemove })
                  .catch(e => {
                    console.error(e);
                    throw new GraphQLError(
                      `Error clearing tags IDs="${tagsToRemove}" to charge ID="${chargeId}"`,
                    );
                  }),
              );
            }
            // add new tags
            const tagIDsToAdd = newTagIDs.filter(tagId => !pastTags.includes(tagId));
            for (const tagId of tagIDsToAdd) {
              tagsPromises.push(
                injector
                  .get(ChargeTagsProvider)
                  .insertChargeTag({ chargeId, tagId })
                  .catch(e => {
                    console.error(e);
                    throw new GraphQLError(
                      `Error adding tag ID="${tagId}" to charge ID="${chargeId}"`,
                    );
                  }),
              );
            }
            await Promise.all(tagsPromises);
          };
          indirectUpdatesPromises.push(updateTagsPromise());
        }

        // handle business trip
        if (fields?.businessTripID) {
          indirectUpdatesPromises.push(
            injector
              .get(BusinessTripsProvider)
              .updateChargeBusinessTrip(
                chargeId,
                fields.businessTripID === EMPTY_UUID ? null : fields.businessTripID,
              )
              .catch(e => {
                console.error(e);
                throw new GraphQLError(`Error updating business trip for charge ID="${chargeId}"`);
              }),
          );
        }

        // handle charge spread
        if (fields?.yearsOfRelevance?.length) {
          const updateSpreadRecords = async () => {
            await injector
              .get(ChargeSpreadProvider)
              .deleteAllChargeSpreadByChargeIds({ chargeIds: [chargeId] })
              .catch(e => {
                console.error(e);
                throw new GraphQLError(`Error deleting spread records for charge ID="${chargeId}"`);
              });

            return injector
              .get(ChargeSpreadProvider)
              .insertChargeSpread({
                chargeSpread: fields.yearsOfRelevance!.map(record => ({
                  chargeId,
                  yearOfRelevance: record.year,
                  amount: record.amount,
                })),
              })
              .catch(e => {
                console.error(e);
                throw new GraphQLError(
                  `Error inserting spread records for charge ID="${chargeId}"`,
                );
              });
          };
          indirectUpdatesPromises.push(updateSpreadRecords());
        }

        await Promise.all(indirectUpdatesPromises);

        return { charge: chargeId };
      } catch (e) {
        let message = 'Error updating charges';
        if (e instanceof GraphQLError) {
          message = e.message;
        }
        return {
          __typename: 'CommonError',
          message,
        };
      }
    },
    batchUpdateCharges: async (_, { chargeIds, fields }, { injector }) => {
      if (!chargeIds || chargeIds.length === 0) {
        return {
          __typename: 'CommonError',
          message: 'No charges provided for update',
        };
      }
      const adjustedFields: IBatchUpdateChargesParams = {
        accountantStatus: fields.accountantApproval,
        type: fields.isConversion ? 'CONVERSION' : undefined,
        isProperty: fields.isProperty,
        isInvoicePaymentDifferentCurrency: fields.isInvoicePaymentDifferentCurrency,
        ownerId: fields.ownerId,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
        optionalVAT: fields.optionalVAT,
        optionalDocuments: fields.optionalDocuments,
        chargeIds,
      };
      try {
        await injector
          .get(ChargesProvider)
          .batchUpdateCharges({ ...adjustedFields })
          .catch(e => {
            console.error(e);
            throw new GraphQLError(`Error updating charges (IDs "${chargeIds.join('", "')}")`);
          });

        const indirectUpdatesPromises: Array<Promise<unknown>> = [];

        // handle tags
        if (fields?.tags) {
          indirectUpdatesPromises.push(
            batchUpdateChargesTags(
              injector,
              fields.tags.map(t => t.id),
              chargeIds,
            ),
          );
        }

        // handle business trip
        if (fields?.businessTripID) {
          indirectUpdatesPromises.push(
            batchUpdateChargesBusinessTrip(injector, fields.businessTripID, chargeIds),
          );
        }

        // handle charge spread
        if (fields?.yearsOfRelevance?.length) {
          indirectUpdatesPromises.push(
            batchUpdateChargesYearsSpread(injector, fields.yearsOfRelevance, chargeIds),
          );
        }

        await Promise.all(indirectUpdatesPromises);

        return { charges: chargeIds };
      } catch (e) {
        let message = 'Error updating charges';
        if (e instanceof GraphQLError) {
          message = e.message;
        }
        return {
          __typename: 'CommonError',
          message,
        };
      }
    },
    mergeCharges: async (_, { baseChargeID, chargeIdsToMerge, fields }, { injector }) => {
      try {
        if (fields) {
          const adjustedFields: IUpdateChargeParams = {
            accountantStatus: fields?.accountantApproval,
            type: fields?.isConversion ? 'CONVERSION' : undefined,
            isProperty: fields?.isProperty,
            isInvoicePaymentDifferentCurrency: fields?.isInvoicePaymentDifferentCurrency,
            optionalVAT: fields?.optionalVAT,
            optionalDocuments: fields?.optionalDocuments,
            ownerId: fields?.ownerId,
            userDescription: fields?.userDescription,
            chargeId: baseChargeID,
          };
          injector.get(ChargesProvider).getChargeByIdLoader.clear(baseChargeID);
          await injector
            .get(ChargesProvider)
            .updateCharge({ ...adjustedFields })
            .catch(e => {
              const message = `Failed to update charge ID="${baseChargeID}" before merge`;
              console.error(`${message}: ${e}`);
              if (e instanceof GraphQLError) {
                throw e;
              }
              throw new Error(message);
            });
        }

        await mergeChargesExecutor(chargeIdsToMerge, baseChargeID, injector);

        return { charge: baseChargeID };
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
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
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
        if (!charge) {
          throw new GraphQLError(`Charge ID="${chargeId}" not found`);
        }
        if (Number(charge.documents_count ?? 0) > 0 || Number(charge.transactions_count ?? 0) > 0) {
          throw new GraphQLError(`Charge ID="${chargeId}" has linked documents/transactions`);
        }

        await deleteCharges([chargeId], injector);
        return true;
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        console.error(e);
        throw new GraphQLError(`Error deleting charge ID="${chargeId}"`);
      }
    },
  },
  UpdateChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'UpdateChargeSuccessfulResult';
    },
  },
  BatchUpdateChargesResult: {
    __resolveType: (obj, _context, _info) => {
      if (('__typename' in obj && obj.__typename === 'CommonError') || 'message' in obj)
        return 'CommonError';
      return 'BatchUpdateChargesSuccessfulResult';
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
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.Common,
    ...commonChargeFields,
  },
  ConversionCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.Conversion,
    ...commonChargeFields,
  },
  SalaryCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.Salary,
    ...commonChargeFields,
  },
  InternalTransferCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.InternalTransfer,
    ...commonChargeFields,
  },
  DividendCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.Dividend,
    ...commonChargeFields,
  },
  BusinessTripCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.BusinessTrip,
    ...commonChargeFields,
  },
  MonthlyVatCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.MonthlyVat,
    ...commonChargeFields,
  },
  BankDepositCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.BankDeposit,
    ...commonChargeFields,
  },
  ForeignSecuritiesCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.ForeignSecurities,
    ...commonChargeFields,
  },
  CreditcardBankCharge: {
    __isTypeOf: async (chargeId, context) =>
      (await getChargeType(chargeId, context)) === ChargeTypeEnum.CreditcardBankCharge,
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
  OtherDocument: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
  },
  ChargeMetadata: {
    createdAt: async (chargeId, _, { injector }) =>
      (await safeGetChargeById(chargeId, injector)).created_at,
    updatedAt: async (chargeId, _, { injector }) =>
      (await safeGetChargeById(chargeId, injector)).updated_at,
    invoicesCount: async (chargeId, _, { injector }) => {
      const documents = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(chargeId);
      const invoicesCount = documents.filter(
        doc =>
          doc.type === DocumentType.Invoice ||
          doc.type === DocumentType.CreditInvoice ||
          doc.type === DocumentType.InvoiceReceipt,
      ).length;
      return invoicesCount;
    },
    receiptsCount: async (chargeId, _, { injector }) => {
      const documents = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(chargeId);
      const receiptsCount = documents.filter(
        doc => doc.type === DocumentType.Receipt || doc.type === DocumentType.InvoiceReceipt,
      ).length;
      return receiptsCount;
    },
    documentsCount: async (chargeId, _, { injector }) => {
      const documents = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(chargeId);
      return documents.length;
    },
    invalidDocuments: async (chargeId, _, { injector }) =>
      (await safeGetChargeById(chargeId, injector)).invalid_documents ?? true,
    openDocuments: async (chargeId, _, { injector }) =>
      (await safeGetChargeById(chargeId, injector)).open_docs_flag ?? false,
    transactionsCount: async (chargeId, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(chargeId);
      return transactions.length;
    },
    invalidTransactions: async (chargeId, _, { injector }) =>
      (await safeGetChargeById(chargeId, injector)).invalid_transactions ?? true,
    ledgerCount: async (chargeId, _, { injector }) => {
      const ledgerRecords = await injector
        .get(LedgerProvider)
        .getLedgerRecordsByChargesIdLoader.load(chargeId);
      return ledgerRecords.length;
    },
    invalidLedger: async (chargeId, _, context, info) => {
      try {
        const charge = await safeGetChargeById(chargeId, context.injector);
        if (isChargeLocked(charge, context.adminContext.ledgerLock)) {
          return 'VALID';
        }

        const generatedLedgerPromise = ledgerGenerationByCharge(charge, context).then(func =>
          func(chargeId, { insertLedgerRecordsIfNotExists: false }, context, info),
        );

        const currentRecordPromise = context.injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(chargeId);

        const [currentRecord, generated] = await Promise.all([
          currentRecordPromise,
          generatedLedgerPromise,
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
        console.error(err);
        return 'INVALID';
      }
    },
    miscExpensesCount: async (chargeId, _, { injector }) => {
      try {
        return injector
          .get(MiscExpensesProvider)
          .getExpensesByChargeIdLoader.load(chargeId)
          .then(res => res.length);
      } catch (err) {
        const message = 'Error loading misc expenses';
        console.error(`${message}: ${err}`);
        throw new GraphQLError(message);
      }
    },
    optionalBusinesses: async (chargeId, _, { injector }) => {
      const charge = await safeGetChargeById(chargeId, injector);
      return charge.business_array && charge.business_array.length > 1 ? charge.business_array : [];
    },
  },
};
