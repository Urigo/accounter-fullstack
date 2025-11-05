import { GraphQLError } from 'graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import {
  addGreenInvoiceClient,
  updateGreenInvoiceClient,
} from '@modules/green-invoice/helpers/green-invoice-clients.helper.js';
import { Resolvers } from '@shared/gql-types';
import { ClientsProvider } from '../providers/clients.provider.js';
import type {
  FinancialEntitiesModule,
  IInsertClientParams,
  IUpdateClientParams,
} from '../types.js';

export const clientsResolvers: FinancialEntitiesModule.Resolvers &
  Pick<Resolvers, 'UpdateClientResponse'> = {
  Query: {
    client: async (_, { businessId }, { injector }) => {
      try {
        const client = await injector.get(ClientsProvider).getClientByIdLoader.load(businessId);

        if (!client) {
          throw new GraphQLError(`Client with ID "${businessId}" not found`);
        }

        return client;
      } catch (error) {
        const message = 'Failed to fetch client';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    allClients: async (_, __, { injector }) => {
      try {
        const matches = await injector.get(ClientsProvider).getAllClients();

        return matches;
      } catch (error) {
        const message = 'Failed to fetch clients';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
  Mutation: {
    updateClient: async (_, { businessId, fields }, { injector }) => {
      const adjustedFields: IUpdateClientParams = {
        businessId,
        emails: fields.emails ? [...fields.emails] : undefined,
        greenInvoiceId: fields.greenInvoiceId,
        hiveId: fields.hiveId,
        newBusinessId: fields.newBusinessId,
      };
      try {
        const [updatedClient] = await injector
          .get(ClientsProvider)
          .updateClient({ ...adjustedFields, businessId })
          .catch((e: Error) => {
            const message = `Error updating client ID="${businessId}"`;
            console.error(`${message}: ${e}`);
            if (e instanceof GraphQLError) {
              throw e;
            }
            throw new Error(message);
          });

        // update green invoice client if needed
        await updateGreenInvoiceClient(businessId, injector, undefined, fields);

        return updatedClient;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Failed to update client ID="${businessId}": ${(e as Error).message}`,
        };
      }
    },
    insertClient: async (_, { fields }, { injector }) => {
      try {
        const newClient: IInsertClientParams = {
          businessId: fields.businessId,
          emails: fields.emails ? [...fields.emails] : [],
          greenInvoiceId: fields.greenInvoiceId,
          hiveId: fields.hiveId,
        };
        const [insertClient] = await injector.get(ClientsProvider).insertClient(newClient);

        if (!insertClient) {
          throw new Error(`No client returned after insertion`);
        }

        // create green invoice client record
        await addGreenInvoiceClient(insertClient.business_id, injector);

        return insertClient;
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: `Failed to create Client`,
        };
      }
    },
  },
  Client: {
    id: business => business.business_id,
    originalBusiness: async (business, _, { injector }) => {
      const businessMatch = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(business.business_id);

      if (!businessMatch) {
        throw new GraphQLError('Client not found');
      }

      return businessMatch;
    },
    greenInvoiceId: business => business.green_invoice_id,
    hiveId: business => business.hive_id,
    emails: business => business.emails ?? [],
    greenInvoiceInfo: async (business, _, { injector }) => {
      if (!business.green_invoice_id) {
        return null;
      }
      const client = await injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(business.green_invoice_id);
      if (!client) {
        throw new GraphQLError(
          `Green Invoice client with ID "${business.green_invoice_id}" not found`,
        );
      }
      const emails = client.emails ? (client.emails.filter(Boolean) as string[]) : [];
      return {
        ...client,
        emails,
        id: business.green_invoice_id,
      };
    },
  },
  LtdFinancialEntity: {
    clientInfo: async (business, _, { injector }) => {
      const client = await injector.get(ClientsProvider).getClientByIdLoader.load(business.id);

      return client || null;
    },
  },
  UpdateClientResponse: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Client';
    },
  },
};
