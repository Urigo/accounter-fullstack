import { GraphQLError } from 'graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { GreenInvoiceProvider } from '@modules/green-invoice/providers/green-invoice.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const clientsResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    client: async (_, { businessId }, { injector }) => {
      try {
        const match = await injector
          .get(GreenInvoiceProvider)
          .getBusinessMatchByIdLoader.load(businessId);

        if (!match) {
          throw new GraphQLError(`Green Invoice business match with ID "${businessId}" not found`);
        }

        return match;
      } catch (error) {
        const message = 'Failed to fetch green invoice business';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    allClients: async (_, __, { injector }) => {
      try {
        const matches = await injector.get(GreenInvoiceProvider).getAllBusinessMatches();

        return matches;
      } catch (error) {
        const message = 'Failed to fetch green invoice businesses';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
  Client: {
    id: business => business.green_invoice_id,
    originalBusiness: async (business, _, { injector }) => {
      const businessMatch = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(business.business_id);

      if (!businessMatch) {
        throw new GraphQLError('Business match not found');
      }

      return businessMatch;
    },
    greenInvoiceId: business => business.green_invoice_id,
    emails: business => business.emails ?? [],
    greenInvoiceInfo: async (business, _, { injector }) => {
      const client = await injector
        .get(GreenInvoiceClientProvider)
        .getClient({ id: business.green_invoice_id });
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
};
