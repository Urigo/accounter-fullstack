import { GraphQLError } from 'graphql';
import { normalizeDocumentType } from '../../../modules/documents/resolvers/common.js';
import { ClientsProvider } from '../../../modules/financial-entities/providers/clients.provider.js';
import { dateToTimelessDateString, formatFinancialAmount } from '../../../shared/helpers/index.js';
import {
  normalizeBillingCycle,
  normalizeProduct,
  normalizeSubscriptionPlan,
} from '../helpers/contracts.helper.js';
import { ContractsProvider } from '../providers/contracts.provider.js';
import type { ContractsModule, IInsertContractParams, IUpdateContractParams } from '../types.js';

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
    contractsByClient: async (_, { clientId }, { injector }) => {
      try {
        return injector.get(ContractsProvider).getContractsByClientIdLoader.load(clientId);
      } catch (e) {
        const message = 'Error fetching contracts by client';
        console.error(message, e);
        throw new GraphQLError(message);
      }
    },
    contractsByAdmin: async (_, { adminId }, { injector }) => {
      try {
        return injector.get(ContractsProvider).getContractsByAdminBusinessIdLoader.load(adminId);
      } catch (e) {
        const message = 'Error fetching contracts by admin';
        console.error(message, e);
        throw new GraphQLError(message);
      }
    },
    contractsById: async (_, { id }, { injector }) => {
      try {
        return injector
          .get(ContractsProvider)
          .getContractsByIdLoader.load(id)
          .then(res => {
            if (!res) throw new GraphQLError('Contract not found');
            return res;
          });
      } catch (e) {
        const message = 'Error fetching contracts by id';
        console.error(message, e);
        throw new GraphQLError(message);
      }
    },
  },
  Mutation: {
    createContract: async (_, { input }, { injector }) => {
      try {
        const params: IInsertContractParams = {
          amount: input.amount.raw,
          billingCycle: input.billingCycle,
          clientId: input.clientId,
          currency: input.amount.currency,
          documentType: input.documentType,
          endDate: input.endDate,
          isActive: input.isActive,
          msCloud: input.msCloud?.toString(),
          plan: input.plan,
          product: input.product,
          purchaseOrders: [...input.purchaseOrders],
          remarks: input.remarks,
          startDate: input.startDate,
          operationsLimit: input.operationsLimit?.toString(),
        };
        return injector.get(ContractsProvider).createContract(params);
      } catch (e) {
        console.error('Error creating contract', e);
        throw new GraphQLError('Error creating contract');
      }
    },
    updateContract: async (_, { contractId, input }, { injector }) => {
      try {
        const params: IUpdateContractParams = {
          contractId,
          amount: input.amount?.raw,
          billing_cycle: input.billingCycle,
          client_id: input.clientId,
          currency: input.amount?.currency,
          document_type: input.documentType,
          end_date: input.endDate,
          is_active: input.isActive,
          ms_cloud: input.msCloud?.toString(),
          plan: input.plan,
          product: input.product,
          purchase_orders: [...input.purchaseOrders],
          remarks: input.remarks,
          start_date: input.startDate,
          operationsLimit: input.operationsLimit?.toString(),
        };
        return injector.get(ContractsProvider).updateContract(params);
      } catch (e) {
        console.error('Error updating contract', e);
        throw new GraphQLError('Error updating contract');
      }
    },
    deleteContract: async (_, { id }, { injector }) => {
      try {
        return injector.get(ContractsProvider).deleteContract(id);
      } catch (e) {
        console.error('Error deleting contract', e);
        throw new GraphQLError('Error deleting contract');
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
    purchaseOrders: dbContract => dbContract.purchase_orders, //String[]
    startDate: dbContract => dateToTimelessDateString(dbContract.start_date), //TimelessDate!
    endDate: dbContract => dateToTimelessDateString(dbContract.end_date), //TimelessDate!
    remarks: dbContract => dbContract.remarks, //String
    amount: dbContract => formatFinancialAmount(dbContract.amount, dbContract.currency), //FinancialAmount!
    documentType: dbContract => normalizeDocumentType(dbContract.document_type), //DocumentType!
    billingCycle: dbContract => normalizeBillingCycle(dbContract.billing_cycle), //BillingCycle!
    isActive: dbContract => dbContract.is_active ?? false, //Boolean!
    product: dbContract => normalizeProduct(dbContract.product), //Product!
    plan: dbContract => normalizeSubscriptionPlan(dbContract.plan), //SubscriptionPlan!
    msCloud: dbContract => dbContract.ms_cloud, //URL
    operationsLimit: dbContract => BigInt(dbContract.operations_count), //Int
  },
};
