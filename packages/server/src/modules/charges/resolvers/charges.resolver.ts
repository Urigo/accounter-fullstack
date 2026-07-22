import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { Resolvers } from '../../../__generated__/types.js';
import { EMPTY_UUID } from '../../../shared/constants.js';
import { ChargeSortByField, ChargeTypeEnum } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
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
import { getChargeType, normalizeDbType } from '../helpers/charge-type.js';
import {
  getChargeBusinesses,
  getChargeDocumentsMeta,
  getChargeLedgerMeta,
  getChargeTransactionsMeta,
  isEnrichedFilteredCharge,
} from '../helpers/common.helper.js';
import { deleteCharges } from '../helpers/delete-charges.helper.js';
import { mergeChargesExecutor } from '../helpers/merge-charges.helper.js';
import { ChargeSpreadProvider } from '../providers/charge-spread.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';
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
  injector: Injector,
) {
  try {
    return (await getChargeType(charge, injector)) === chargeType;
  } catch (error) {
    throw errorSimplifier('Failed to determine charge type', error);
  }
}

/**
 * Whether a charge holds no transactions, documents, ledger records or misc
 * expenses. Counts only: enriched rows (from `getChargesByFilters`) carry the
 * aggregates, and otherwise the per-charge loaders are read for their length
 * alone — the meta helpers would additionally re-derive amounts, dates and
 * validation flags this check has no use for.
 */
async function isChargeEmpty(charge: IGetChargesByIdsResult, injector: Injector): Promise<boolean> {
  const isEnriched = isEnrichedFilteredCharge(charge);

  const [transactionsCount, documentsCount, ledgerCount, miscExpensesCount] = await Promise.all([
    isEnriched
      ? Number(charge.transactions_count ?? 0)
      : injector
          .get(TransactionsProvider)
          .transactionsByChargeIDLoader.load(charge.id)
          .then(transactions => transactions.length),
    isEnriched
      ? Number(charge.documents_count ?? 0)
      : injector
          .get(DocumentsProvider)
          .getDocumentsByChargeIdLoader.load(charge.id)
          .then(documents => documents.length),
    isEnriched
      ? Number(charge.ledger_count ?? 0)
      : injector
          .get(LedgerProvider)
          .getLedgerRecordsByChargesIdLoader.load(charge.id)
          .then(records => records.length),
    injector
      .get(MiscExpensesProvider)
      .getExpensesByChargeIdLoader.load(charge.id)
      .then(expenses => expenses.length),
  ]);

  return (
    transactionsCount === 0 && documentsCount === 0 && ledgerCount === 0 && miscExpensesCount === 0
  );
}

/**
 * Whether a charge update should degrade the charge's accountant approval
 * (APPROVED -> PENDING). Tag changes and explicit accountant-approval changes
 * are intentionally excluded: tags are not accountant-relevant, and an explicit
 * approval change is the user deliberately setting the status.
 */
function chargeUpdateRequiresApprovalDegrade(fields: {
  accountantApproval?: unknown;
  type?: unknown;
  isDecreasedVAT?: unknown;
  defaultTaxCategoryID?: unknown;
  optionalVAT?: unknown;
  optionalDocuments?: unknown;
  businessTripID?: unknown;
  yearsOfRelevance?: unknown;
}): boolean {
  if (fields.accountantApproval != null) {
    return false;
  }
  return [
    fields.type,
    fields.isDecreasedVAT,
    fields.defaultTaxCategoryID,
    fields.optionalVAT,
    fields.optionalDocuments,
    fields.businessTripID,
    fields.yearsOfRelevance,
  ].some(value => value !== undefined);
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
          const charge = dbCharges.find(
            charge => charge && !(charge instanceof Error) && charge.id === id,
          ) as IGetChargesByIdsResult | undefined;
          if (!charge) {
            throw new GraphQLError(`Charge ID="${id}" not found`);
          }
          return charge;
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
          businessTripIds: filters?.byBusinessTrips,
          withMissingCounterparty: filters?.withMissingCounterparty,
          withoutInvoice: filters?.withoutInvoice,
          withoutReceipt: filters?.withoutReceipt,
          withoutDocuments: filters?.withoutDocuments,
          withOpenDocuments: filters?.withOpenDocuments,
          withoutTransactions: filters?.withoutTransactions,
          withoutLedger: filters?.withoutLedger,
          freeText: filters?.freeText?.trim().toLowerCase(),
          tags: filters?.byTags,
          accountantStatuses: filters?.accountantStatus as accountant_statusArray | undefined,
        })
        .catch(error => {
          throw errorSimplifier('Error fetching charges', error);
        });

      // charge __typename is resolved dynamically, so filter by concrete type post-fetch
      let filteredCharges = charges;
      if (filters?.byChargeTypes?.length) {
        const wantedTypes = new Set<ChargeTypeEnum>(filters.byChargeTypes?.map(normalizeDbType));
        const chargeTypes = await Promise.all(
          charges.map(charge =>
            getChargeType(charge, injector).catch(error => {
              throw errorSimplifier('Failed to determine charge type', error);
            }),
          ),
        );
        filteredCharges = charges.filter((_, index) => wantedTypes.has(chargeTypes[index]));
      }

      const pageCharges = filteredCharges.slice(page * limit, (page + 1) * limit);

      return {
        __typename: 'PaginatedCharges',
        nodes: pageCharges,
        pageInfo: {
          totalPages: Math.ceil(filteredCharges.length / limit),
          totalRecords: filteredCharges.length,
        },
      };
    },
    chargesWithMissingRequiredInfo: async (_, { page, limit }, { injector }) => {
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

        const readScope = await injector.get(ScopeProvider).getReadScope();

        const pageCharges = charges
          .filter(charge => !!charge.owner_id && readScope.includes(charge.owner_id))
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
        type: fields.type,
        isProperty: fields.isDecreasedVAT,
        isInvoicePaymentDifferentCurrency: fields.isInvoicePaymentDifferentCurrency,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
        optionalVAT: fields.optionalVAT,
        optionalDocuments: fields.optionalDocuments,
        chargeId,
      };
      try {
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
                  ownerId: updatedCharge.owner_id,
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

        if (chargeUpdateRequiresApprovalDegrade(fields)) {
          const degradedCharges = await degradeChargesAccountantApproval(injector, [chargeId]);
          return { charge: degradedCharges.get(chargeId) ?? updatedCharge };
        }

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
        type: fields.type,
        isProperty: fields.isDecreasedVAT,
        isInvoicePaymentDifferentCurrency: fields.isInvoicePaymentDifferentCurrency,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
        optionalVAT: fields.optionalVAT,
        optionalDocuments: fields.optionalDocuments,
        chargeIds,
      };
      try {
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
        const charges = updatedCharges as IGetChargesByIdsResult[];

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

        if (chargeUpdateRequiresApprovalDegrade(fields)) {
          const degradedCharges = await degradeChargesAccountantApproval(injector, chargeIds);
          if (degradedCharges.size > 0) {
            return { charges: charges.map(charge => degradedCharges.get(charge.id) ?? charge) };
          }
        }

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
            type: fields?.type,
            isProperty: fields?.isDecreasedVAT,
            isInvoicePaymentDifferentCurrency: fields?.isInvoicePaymentDifferentCurrency,
            optionalVAT: fields?.optionalVAT,
            optionalDocuments: fields?.optionalDocuments,
            userDescription: fields?.userDescription,
            chargeId: baseChargeID,
          };
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

        const degradedCharges = await degradeChargesAccountantApproval(injector, [baseChargeID]);

        return { charge: degradedCharges.get(baseChargeID) ?? charge };
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
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.Common, DbCharge, injector),
    ...commonChargeFields,
  },
  ConversionCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.Conversion, DbCharge, injector),
    ...commonChargeFields,
  },
  SalaryCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.Salary, DbCharge, injector),
    ...commonChargeFields,
  },
  InternalTransferCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.InternalTransfer, DbCharge, injector),
    ...commonChargeFields,
  },
  DividendCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.Dividend, DbCharge, injector),
    ...commonChargeFields,
  },
  BusinessTripCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.BusinessTrip, DbCharge, injector),
    ...commonChargeFields,
  },
  MonthlyVatCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.MonthlyVat, DbCharge, injector),
    ...commonChargeFields,
  },
  BankDepositCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.BankDeposit, DbCharge, injector),
    ...commonChargeFields,
  },
  ForeignSecuritiesCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.ForeignSecurities, DbCharge, injector),
    ...commonChargeFields,
  },
  CreditcardBankCharge: {
    __isTypeOf: async (DbCharge, { injector }) =>
      chargeTypeChecker(ChargeTypeEnum.CreditcardBankCharge, DbCharge, injector),
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
      if (isEnrichedFilteredCharge(DbCharge)) {
        return Number(DbCharge.invoices_count ?? 0);
      }
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
      if (isEnrichedFilteredCharge(DbCharge)) {
        return Number(DbCharge.receipts_count ?? 0);
      }
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
      if (isEnrichedFilteredCharge(DbCharge)) {
        return Number(DbCharge.documents_count ?? 0);
      }
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
      if (isEnrichedFilteredCharge(DbCharge)) {
        return DbCharge.open_docs_flag ?? false;
      }
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
      if (isEnrichedFilteredCharge(DbCharge)) {
        return Number(DbCharge.transactions_count ?? 0);
      }
      const transactions = await injector
        .get(TransactionsProvider)
        .transactionsByChargeIDLoader.load(DbCharge.id)
        .catch(error => {
          throw errorSimplifier('Error loading transactions', error);
        });
      return transactions.length;
    },
    ledgerCount: async (DbCharge, _, { injector }) => {
      if (isEnrichedFilteredCharge(DbCharge)) {
        return Number(DbCharge.ledger_count ?? 0);
      }
      return injector
        .get(LedgerProvider)
        .getLedgerRecordsByChargesIdLoader.load(DbCharge.id)
        .catch(error => {
          throw errorSimplifier('Error loading ledger records', error);
        })
        .then(records => records.length);
    },
    invalidLedger: async (DbCharge, _, context, info) => {
      const { injector } = context;

      try {
        const { ledgerLock } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        if (await isChargeLocked(DbCharge, injector, ledgerLock)) {
          return 'VALID';
        }

        // An empty common-type charge (no transactions, documents, ledger
        // records or misc expenses) generates an empty, error-free ledger that
        // trivially matches the empty stored ledger — skip the expensive
        // generation. Scoped to common-type charges: specialized types may
        // legitimately report errors on missing data.
        const chargeType = await getChargeType(DbCharge, injector);
        if (
          (chargeType === ChargeTypeEnum.Common ||
            chargeType === ChargeTypeEnum.CreditcardBankCharge) &&
          (await isChargeEmpty(DbCharge, injector))
        ) {
          return 'VALID';
        }

        const generatedLedgerPromise = ledgerGenerationByCharge(
          DbCharge,
          { insertLedgerRecordsIfNotExists: false },
          context,
          info,
        );

        const currentRecordPromise = injector
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
        const { allBusinessIds } = await getChargeBusinesses(DbCharge, injector);
        return allBusinessIds.length > 1 ? allBusinessIds : [];
      } catch (error) {
        throw errorSimplifier('Failed to fetch optional businesses', error);
      }
    },
  },
};
