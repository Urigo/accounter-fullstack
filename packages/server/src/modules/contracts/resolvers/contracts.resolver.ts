import { GraphQLError } from 'graphql';
import { normalizeDocumentType } from '@modules/documents/resolvers/common.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import {
  normalizeBillingCycle,
  normalizeProduct,
  normalizeSubscriptionPlan,
} from '../helpers/contracts.helper.js';
import { ContractsProvider } from '../providers/contracts.provider.js';
import type { ContractsModule } from '../types.js';

export const contractsResolvers: ContractsModule.Resolvers = {
  Query: {
    allOpenContracts: async (_, __, { injector }) => {
      try {
        return injector.get(ContractsProvider).getAllOpenContracts();
      } catch (e) {
        console.error('Error fetching countries', e);
        throw new GraphQLError('Error fetching countries');
      }
    },
  },
  Contract: {
    id: dbContract => dbContract.id,
    client: async (dbContract, _, { injector }) => {
      return injector
        .get(ClientsProvider)
        .getClientByIdLoader.load(dbContract.client_id)
        .then(res => {
          if (!res) throw new GraphQLError('Client not found');
          return res;
        })
        .catch(err => {
          console.error('Error fetching client', err);
          throw new GraphQLError('Error fetching client');
        });
    },
    purchaseOrder: dbContract => dbContract.purchase_order, //String
    startDate: dbContract => dateToTimelessDateString(dbContract.start_date), //TimelessDate!
    endDate: dbContract => dateToTimelessDateString(dbContract.end_date), //TimelessDate!
    remarks: dbContract => dbContract.remarks, //String
    amount: dbContract => formatFinancialAmount(dbContract.amount, dbContract.currency), //FinancialAmount!
    documentType: dbContract => normalizeDocumentType(dbContract.document_type), //DocumentType!
    billingCycle: dbContract => normalizeBillingCycle(dbContract.billing_cycle), //BillingCycle!
    isActive: dbContract => dbContract.is_active ?? false, //Boolean!
    product: dbContract => normalizeProduct(dbContract.product), //Product!
    plan: dbContract => normalizeSubscriptionPlan(dbContract.plan), //SubscriptionPlan!
    signedAgreement: dbContract => dbContract.signed_agreement, //URL
    msCloud: dbContract => dbContract.ms_cloud, //URL
  },
};
