import { GraphQLError } from 'graphql';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { tags as tagNames } from '@modules/tags/types.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { ChargeSortByField } from '@shared/enums';
import type { ChargeResolvers, Resolvers } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargeRequiredWrapper, ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IGetChargesByIdsResult, IUpdateChargeParams } from '../types.js';
import {
  commonDocumentsFields,
  commonFinancialAccountFields,
  commonFinancialEntityFields,
} from './common.js';

const calculateTotalAmount: ChargeResolvers['totalAmount'] = async charge => {
  if (charge.documents_event_amount != null && charge.documents_currency) {
    return formatFinancialAmount(charge.documents_event_amount, charge.documents_currency);
  }
  if (charge.transactions_event_amount != null && charge.transactions_currency) {
    return formatFinancialAmount(charge.transactions_event_amount, charge.transactions_currency);
  }
  return null;
};

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

      const chargeIDs = new Set<string>();
      const documents = await injector.get(DocumentsProvider).getDocumentsByFilters({
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        businessIDs: filters?.byBusinesses,
      });

      documents.map(doc => {
        if (doc.charge_id_new) {
          chargeIDs.add(doc.charge_id_new);
        }
      });

      const transactions = await injector.get(TransactionsProvider).getTransactionsByFilters({
        fromEventDate: filters?.fromDate,
        toEventDate: filters?.toDate,
        businessIDs: filters?.byBusinesses,
      });

      transactions.map(t => {
        if (t.charge_id) {
          chargeIDs.add(t.charge_id);
        }
      });

      let charges = await injector
        .get(ChargesProvider)
        .getChargesByFilters({
          IDs: Array.from(chargeIDs),
          ownerIds: filters?.byOwners ?? undefined,
          fromDate: filters?.fromDate,
          toDate: filters?.toDate,
          fromAnyDate: filters?.fromAnyDate,
          toAnyDate: filters?.toAnyDate,
          sortColumn,
          asc: filters?.sortBy?.asc !== false,
          chargeType: filters?.chargesType,
        })
        .catch(e => {
          throw new Error(e.message);
        });

      // apply post-query filters
      if (
        // filters?.unbalanced ||
        filters?.withoutInvoice ||
        filters?.withoutDocuments
      ) {
        charges = charges.filter(
          c =>
            // (!filters?.unbalanced || Number(c.balance) !== 0) &&
            (!filters?.withoutInvoice || Number(c.invoices_count) === 0) &&
            (!filters?.withoutDocuments ||
              Number(c.receipts_count) + Number(c.invoices_count) === 0) &&
            (!filters?.withoutTransaction || Number(c.transactions_count) === 0),
        );
      }

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
        accountantReviewed: fields.accountantApproval?.approved,
        isConversion: fields.isConversion,
        isProperty: fields.isProperty,
        ownerId: fields.ownerId,
        userDescription: fields.userDescription,
        taxCategoryId: fields.defaultTaxCategoryID,
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
        if (fields?.tags?.length) {
          const newTags = fields.tags.map(t => t.name);
          const pastTagsItems = await injector
            .get(TagsProvider)
            .getTagsByChargeIDLoader.load(chargeId);
          const pastTags = pastTagsItems.map(({ tag_name }) => tag_name);
          // clear removed tags
          const tagsToRemove = pastTags.filter(tag => !newTags.includes(tag));
          if (tagsToRemove.length) {
            await injector.get(TagsProvider).clearChargeTags({ chargeId, tagNames: tagsToRemove });
          }
          // add new tags
          for (const tag of newTags as tagNames[]) {
            if (!pastTags.includes(tag)) {
              await injector
                .get(TagsProvider)
                .insertChargeTags({ chargeId, tagName: tag })
                .catch(() => {
                  throw new GraphQLError(`Error adding tag "${tag}" to charge ID="${chargeId}"`);
                });
            }
          }
        }

        return updatedCharge;
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
            accountantReviewed: fields?.accountantApproval?.approved,
            isConversion: fields?.isConversion,
            isProperty: fields?.isProperty,
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

        for (const id of chargeIdsToMerge) {
          // update linked documents
          await injector.get(DocumentsProvider).replaceDocumentsChargeId({
            replaceChargeID: id,
            assertChargeID: baseChargeID,
          });

          // update linked transactions
          await injector.get(TransactionsProvider).replaceTransactionsChargeId({
            replaceChargeID: id,
            assertChargeID: baseChargeID,
          });

          // clear tags
          await injector.get(TagsProvider).clearAllChargeTags({ chargeId: id });

          // delete charge
          await injector.get(ChargesProvider).deleteChargesByIds({ chargeIds: [id] });
        }

        return charge;
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
  },
  UpdateChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
    },
  },
  MergeChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
    },
  },
  Charge: {
    id: DbCharge => DbCharge.id,
    vat: DbCharge =>
      DbCharge.documents_vat_amount != null && DbCharge.documents_currency
        ? formatFinancialAmount(DbCharge.documents_vat_amount, DbCharge.documents_currency)
        : null,
    totalAmount: calculateTotalAmount,
    property: DbCharge => DbCharge.is_property,
    conversion: DbCharge => DbCharge.is_conversion,
    userDescription: DbCharge => DbCharge.user_description,
    minEventDate: DbCharge => DbCharge.transactions_min_event_date,
    minDebitDate: DbCharge => DbCharge.transactions_min_debit_date,
    minDocumentsDate: DbCharge => DbCharge.documents_min_date,
    validationData: (DbCharge, _, { injector }) => validateCharge(DbCharge, injector),
    metadata: DbCharge => ({
      createdOn: DbCharge.created_on,
      updatedOn: DbCharge.updated_on,
      invoicesCount: Number(DbCharge.invoices_count) ?? 0,
      receiptsCount: Number(DbCharge.receipts_count) ?? 0,
      documentsCount: Number(DbCharge.documents_count) ?? 0,
      invalidDocuments: DbCharge.invalid_documents ?? true,
      transactionsCount: Number(DbCharge.transactions_count) ?? 0,
      invalidTransactions: DbCharge.invalid_transactions ?? true,
      optionalBusinesses:
        DbCharge.business_array && DbCharge.business_array.length > 1
          ? DbCharge.business_array
          : [],
    }),
  },
  Invoice: {
    ...commonDocumentsFields,
  },
  InvoiceReceipt: {
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
};
