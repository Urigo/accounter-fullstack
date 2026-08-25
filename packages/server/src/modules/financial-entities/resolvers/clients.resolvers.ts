import { GraphQLError } from 'graphql';
import type { ClientIntegrationsInput, Resolvers } from '../../../__generated__/types.js';
import { normalizeDocumentType } from '../../documents/resolvers/common.js';
import {
  addGreenInvoiceClient,
  updateGreenInvoiceClient,
} from '../../green-invoice/helpers/green-invoice-clients.helper.js';
import { parseStoredClientIntegrations } from '../helpers/clients.helper.js';
import { BusinessesProvider } from '../providers/businesses.provider.js';
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
      let updatedIntegrations: ClientIntegrationsInput | undefined =
        fields.integrations ?? undefined;
      if (updatedIntegrations) {
        const currentClient = await injector
          .get(ClientsProvider)
          .getClientByIdLoader.load(businessId);
        if (!currentClient) {
          throw new GraphQLError(`Client with ID="${businessId}" not found`);
        }
        const currentIntegrations = parseStoredClientIntegrations(currentClient.integrations);
        updatedIntegrations = {
          ...currentIntegrations,
          ...updatedIntegrations,
        };
      }
      const adjustedFields: IUpdateClientParams = {
        businessId,
        emails: fields.emails ? [...fields.emails] : undefined,
        newBusinessId: fields.newBusinessId,
        generatedDocumentType: fields.generatedDocumentType,
        integrations: updatedIntegrations,
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
          generatedDocumentType: fields.generatedDocumentType,
          integrations: fields.integrations ?? {},
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
    ownerId: business => business.owner_id,
    originalBusiness: async (business, _, { injector }) => {
      const businessMatch = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(business.business_id);

      if (!businessMatch) {
        throw new GraphQLError('Business not found');
      }

      return businessMatch;
    },
    emails: business => business.emails ?? [],
    // The client-level default. NOT what actually gets issued for a given
    // billing agreement — that is `Contract.documentType`, set per contract.
    generatedDocumentType: business => normalizeDocumentType(business.document_type),
    integrations: business => business,
  },
  ClientIntegrations: {
    id: business => `${business.business_id}-integrations`,
    hiveId: business => parseStoredClientIntegrations(business.integrations).hiveId ?? null,
    linearId: business => parseStoredClientIntegrations(business.integrations).linearId ?? null,
    slackChannelKey: business =>
      parseStoredClientIntegrations(business.integrations).slackChannelKey ?? null,
    notionId: business => parseStoredClientIntegrations(business.integrations).notionId ?? null,
    workflowyUrl: business =>
      parseStoredClientIntegrations(business.integrations).workflowyUrl ?? null,
  },
  LtdFinancialEntity: {
    clientInfo: async (business, _, { injector }) => {
      const client = await injector.get(ClientsProvider).getClientByIdLoader.load(business.id);

      return client || null;
    },
    isClient: async (business, _, { injector }) => {
      const client = await injector.get(ClientsProvider).getClientByIdLoader.load(business.id);

      return !!client;
    },
  },
  UpdateClientResponse: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Client';
    },
  },
};
