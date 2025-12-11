import { GraphQLError } from 'graphql';
import type { Resolvers } from '../../../__generated__/types.js';
import { EMPTY_UUID } from '../../../shared/constants.js';
import { ChargeSortByField, ChargeTypeEnum } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { isInvoice, isReceipt } from '../../documents/helpers/common.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '../../documents/providers/issued-documents.provider.js';
import { ledgerGenerationByCharge } from '../../ledger/helpers/ledger-by-charge-type.helper.js';
import { isChargeLocked } from '../../ledger/helpers/ledger-lock.js';
import { ledgerRecordsGenerationFullMatchComparison } from '../../ledger/helpers/ledgrer-storage.helper.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import {
  batchUpdateChargesBusinessTrip,
  batchUpdateChargesTags,
  batchUpdateChargesYearsSpread,
} from '../helpers/batch-update-charges.js';
import { getChargeType } from '../helpers/charge-type.js';
import {
  getChargeBusinesses,
  getChargeDocumentsMeta,
  getChargeLedgerMeta,
  getChargeTransactionsMeta,
} from '../helpers/common.helper.js';
import { deleteCharges } from '../helpers/delete-charges.helper.js';
import { mergeChargesExecutor } from '../helpers/merge-charges.helper.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargeRequiredWrapper, ChargesProvider } from '../providers/charges.provider.js';
import type {
  accountant_statusArray,
  ChargesModule,
  IBatchUpdateChargesParams,
  IGetChargesByIdsResult,
  IUpdateChargeParams,
} from '../types.js';
import { commonChargeFields, commonDocumentsFields } from './common.js';

async function chargeTypeChecker(
  chargeType: ChargeTypeEnum,
  charge: IGetChargesByIdsResult,
  context: GraphQLModules.Context,
) {
  try {
    return (await getChargeType(charge, context)) === chargeType;
  } catch (error) {
    throw errorSimplifier('Failed to determine charge type', error);
  }
}

export const chargesResolvers: ChargesModule.Resolvers &
  Pick<Resolvers, 'UpdateChargeResult' | 'MergeChargeResult' | 'BatchUpdateChargesResult'> = {
  Query: {
    charge: async (_, { chargeId }, { injector }) => {
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
        if (!charge) {
          throw new GraphQLError(`Charge ID="${chargeId}" not found`);
        }
        return charge;
      } catch (error) {
        throw errorSimplifier('Failed to fetch charge by ID', error);
      }
    },
    chargesByIDs: async (_, { chargeIDs }, { injector }) => {
      if (chargeIDs.length === 0) {
        return [];
      }

      try {
        const dbCharges = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.loadMany(chargeIDs);
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
      } catch (error) {
        throw errorSimplifier('Failed to fetch charges by IDs', error);
      }
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
        .catch(error => {
          throw errorSimplifier('Error fetching charges', error);
        });

      const pageCharges = charges.slice(page * limit, (page + 1) * limit);

      return {
        __typename: 'PaginatedCharges',
        nodes: pageCharges,
        pageInfo: {
          totalPages: Math.ceil(charges.length / limit),
          totalRecords: charges.length,
        },
      };
    },
    chargesWithMissingRequiredInfo: async (_, { page, limit }, { injector, adminContext }) => {
      try {
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
          Array.from(chargeIds).map(async id => {
            const [
              charge,
              { transactionsMinDebitDate, transactionsMinEventDate },
              { ledgerMinInvoiceDate, ledgerMinValueDate },
              { documentsMinDate },
            ] = await Promise.all([
              injector
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
              getChargeTransactionsMeta(id, injector),
              getChargeLedgerMeta(id, injector),
              getChargeDocumentsMeta(id, injector),
            ]);
            return {
              ...charge,
              transactionsMinDebitDate,
              transactionsMinEventDate,
              ledgerMinInvoiceDate,
              ledgerMinValueDate,
              documentsMinDate,
            };
          }),
        );

        const pageCharges = charges
          .filter(charge => charge.owner_id === adminContext.defaultAdminBusinessId)
          .sort((chargeA, chargeB) => {
            const dateA =
              (
                chargeA.documentsMinDate ||
                chargeA.transactionsMinDebitDate ||
                chargeA.transactionsMinEventDate ||
                chargeA.ledgerMinValueDate ||
                chargeA.ledgerMinInvoiceDate
              )?.getTime() ?? 0;
            const dateB =
              (
                chargeB.documentsMinDate ||
                chargeB.transactionsMinDebitDate ||
                chargeB.transactionsMinEventDate ||
                chargeB.ledgerMinValueDate ||
                chargeB.ledgerMinInvoiceDate
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
          nodes: pageCharges,
          pageInfo: {
            totalPages: Math.ceil(charges.length / limit),
            totalRecords: charges.length,
          },
        };
      } catch (error) {
        throw errorSimplifier('Failed to fetch charges with missing required info', error);
      }
    },
  },
  Mutation: {
    updateCharge: async (_, { chargeId, fields }, { injector }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountantStatus: fields.accountantApproval,
        type: fields.isConversion ? 'CONVERSION' : undefined,
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
        const updatedCharge = await injector
          .get(ChargesProvider)
          .updateCharge({ ...adjustedFields })
          .catch(e => {
            console.error(e);
            throw new GraphQLError(`Error updating charge ID="${chargeId}"`);
          });
        if (!updatedCharge) {
          throw new Error(`Charge ID="${chargeId}" not found`);
        }

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

        return { charge: updatedCharge };
      } catch (e) {
        let message = 'Error updating charges';
        if (e instanceof GraphQLError) {
          message = e.message;
        } else {
          console.error(e);
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
        isInvoicePaymentDifferentCurrency: fields.isInvoicePaymentDifferentCurrency,
        ownerId: fields.ownerId,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
        optionalVAT: fields.optionalVAT,
        optionalDocuments: fields.optionalDocuments,
        chargeIds,
      };
      try {
        for (const chargeId of chargeIds) {
          injector.get(ChargesProvider).getChargeByIdLoader.clear(chargeId);
        }
        const res = await injector
          .get(ChargesProvider)
          .batchUpdateCharges({ ...adjustedFields })
          .catch(e => {
            console.error(e);
            throw new GraphQLError(`Error updating charges (IDs "${chargeIds.join('", "')}")`);
          });
        const updatedCharges = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.loadMany(res.map(c => c.id))
          .catch(e => {
            console.error(e);
            throw new GraphQLError(
              `Error loading updated charges (IDs "${chargeIds.join('", "')}")`,
            );
          });

        // check if all charges were updated successfully
        if (!updatedCharges) {
          throw new GraphQLError(`Updated charges not found (IDs "${chargeIds.join('", "')}")`);
        }
        if (updatedCharges.some(charge => !charge || charge instanceof Error)) {
          throw new GraphQLError(
            `Some updated charges not found (IDs "${chargeIds.join('", "')}")`,
          );
        }

        // Type assertion as error handling is done above
        const charges = updatedCharges as ChargeRequiredWrapper<IGetChargesByIdsResult>[];

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

        return { charges };
      } catch (e) {
        let message = 'Error updating charges';
        if (e instanceof GraphQLError) {
          message = e.message;
        } else {
          console.error(e);
        }
        return {
          __typename: 'CommonError',
          message,
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
            accountantStatus: fields?.accountantApproval,
            type: fields?.isConversion ? 'CONVERSION' : undefined,
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

        return { charge };
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        console.error(e);
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
        const [charge, transactions, documents] = await Promise.all([
          injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
          injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(chargeId),
          injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
        ]);
        if (!charge) {
          throw new GraphQLError(`Charge ID="${chargeId}" not found`);
        }
        if (documents.length > 0 || transactions.length > 0) {
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
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.Common, DbCharge, context),
    ...commonChargeFields,
  },
  ConversionCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.Conversion, DbCharge, context),
    ...commonChargeFields,
  },
  SalaryCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.Salary, DbCharge, context),
    ...commonChargeFields,
  },
  InternalTransferCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.InternalTransfer, DbCharge, context),
    ...commonChargeFields,
  },
  DividendCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.Dividend, DbCharge, context),
    ...commonChargeFields,
  },
  BusinessTripCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.BusinessTrip, DbCharge, context),
    ...commonChargeFields,
  },
  MonthlyVatCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.MonthlyVat, DbCharge, context),
    ...commonChargeFields,
  },
  BankDepositCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.BankDeposit, DbCharge, context),
    ...commonChargeFields,
  },
  ForeignSecuritiesCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.ForeignSecurities, DbCharge, context),
    ...commonChargeFields,
  },
  CreditcardBankCharge: {
    __isTypeOf: async (DbCharge, context) =>
      chargeTypeChecker(ChargeTypeEnum.CreditcardBankCharge, DbCharge, context),
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
    createdAt: DbCharge => DbCharge.created_at,
    updatedAt: DbCharge => DbCharge.updated_at,
    invoicesCount: async (DbCharge, _, { injector }) => {
      try {
        return injector
          .get(DocumentsProvider)
          .getDocumentsByChargeIdLoader.load(DbCharge.id)
          .then(docs => docs.filter(doc => isInvoice(doc.type)).length);
      } catch (err) {
        throw errorSimplifier('Error loading invoices', err);
      }
    },
    receiptsCount: async (DbCharge, _, { injector }) => {
      try {
        return injector
          .get(DocumentsProvider)
          .getDocumentsByChargeIdLoader.load(DbCharge.id)
          .then(docs => docs.filter(doc => isReceipt(doc.type)).length);
      } catch (err) {
        throw errorSimplifier('Error loading receipts', err);
      }
    },
    documentsCount: async (DbCharge, _, { injector }) => {
      try {
        return injector
          .get(DocumentsProvider)
          .getDocumentsByChargeIdLoader.load(DbCharge.id)
          .then(docs => docs.length);
      } catch (err) {
        throw errorSimplifier('Error loading documents', err);
      }
    },
    openDocuments: async (DbCharge, _, { injector }) => {
      try {
        const res = await injector
          .get(IssuedDocumentsProvider)
          .getIssuedDocumentsStatusByChargeIdLoader.load(DbCharge.id);
        return res?.open_docs_flag ?? false;
      } catch (error) {
        throw errorSimplifier('Error loading open documents status', error);
      }
    },
    transactionsCount: async (DbCharge, _, { injector }) => {
      const transactions = await injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(DbCharge.id)
        .catch(error => {
          throw errorSimplifier('Error loading transactions', error);
        });
      return transactions.length;
    },
    ledgerCount: async (DbCharge, _, { injector }) =>
      injector
        .get(LedgerProvider)
        .getLedgerRecordsByChargesIdLoader.load(DbCharge.id)
        .catch(error => {
          throw errorSimplifier('Error loading ledger records', error);
        })
        .then(records => records.length),
    invalidLedger: async (DbCharge, _, context, info) => {
      try {
        if (await isChargeLocked(DbCharge, context.injector, context.adminContext.ledgerLock)) {
          return 'VALID';
        }

        const generatedLedgerPromise = ledgerGenerationByCharge(
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
    miscExpensesCount: async (DbCharge, _, { injector }) => {
      try {
        return injector
          .get(MiscExpensesProvider)
          .getExpensesByChargeIdLoader.load(DbCharge.id)
          .then(res => res.length);
      } catch (err) {
        throw errorSimplifier('Error loading misc expenses', err);
      }
    },
    optionalBusinesses: async (DbCharge, _, { injector }) => {
      try {
        const { allBusinessIds } = await getChargeBusinesses(DbCharge.id, injector);
        return allBusinessIds.length > 1 ? allBusinessIds : [];
      } catch (error) {
        throw errorSimplifier('Failed to fetch optional businesses', error);
      }
    },
    isSalary: DbCharge => DbCharge.type === 'PAYROLL',
  },
};
