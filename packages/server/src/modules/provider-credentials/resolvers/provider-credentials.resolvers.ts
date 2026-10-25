import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import {
  ProviderCredentialsProvider,
  type ProviderKey as DbProviderKey,
} from '../providers/provider-credentials.provider.js';
import type { ProviderCredentialsModule } from '../types.js';

const DB_TO_GQL: Record<DbProviderKey, ProviderCredentialsModule.ProviderKey> = {
  green_invoice: 'GREEN_INVOICE' as ProviderCredentialsModule.ProviderKey,
  deel: 'DEEL' as ProviderCredentialsModule.ProviderKey,
};

const GQL_TO_DB: Record<ProviderCredentialsModule.ProviderKey, DbProviderKey> = {
  GREEN_INVOICE: 'green_invoice',
  DEEL: 'deel',
};

export const providerCredentialsResolvers: ProviderCredentialsModule.Resolvers = {
  Query: {
    providerCredentials: async (_parent, _args, { injector }) => {
      const statuses = await injector.get(ProviderCredentialsProvider).getProviderStatuses();
      return statuses
        .filter((s): s is typeof s & { provider: DbProviderKey } => s.provider in DB_TO_GQL)
        .map(s => ({
          id: DB_TO_GQL[s.provider],
          provider: DB_TO_GQL[s.provider],
          configuredAt: new Date(s.configuredAt),
          businessId: s.businessId,
        }));
    },
  },

  ProviderCredentialStatus: {
    business: async (parent, _, { injector }) =>
      parent.businessId
        ? ((await injector.get(BusinessesProvider).getBusinessByIdLoader.load(parent.businessId)) ??
          null)
        : null,
  },

  Mutation: {
    setGreenInvoiceCredentials: async (_parent, { id, secret }, { injector }) => {
      // TODO: Ensure 'id' and 'secret' are added to the logging redaction list if structured logging is introduced
      try {
        const updatedAt = await injector
          .get(ProviderCredentialsProvider)
          .setCredentials('green_invoice', { id, secret });

        if (!updatedAt) {
          throw new Error('Failed to save Green Invoice credentials');
        }

        return {
          __typename: 'ProviderCredentialResult' as const,
          id: DB_TO_GQL['green_invoice'],
          provider: DB_TO_GQL['green_invoice'],
          configuredAt: new Date(updatedAt),
        };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Failed to save Green Invoice credentials';
        console.error('setGreenInvoiceCredentials error:', e);
        return { __typename: 'CommonError' as const, message };
      }
    },

    setDeelCredentials: async (_parent, { apiToken, businessId }, { injector }) => {
      // TODO: Ensure 'apiToken' is added to the logging redaction list if structured logging is introduced
      try {
        const updatedAt = await injector
          .get(ProviderCredentialsProvider)
          .setCredentials('deel', { apiToken }, { businessId });

        if (!updatedAt) {
          throw new Error('Failed to save Deel credentials');
        }

        return {
          __typename: 'ProviderCredentialResult' as const,
          id: DB_TO_GQL['deel'],
          provider: DB_TO_GQL['deel'],
          configuredAt: new Date(updatedAt),
          // an omitted businessId keeps the stored one — report what was saved
          businessId:
            (await injector.get(ProviderCredentialsProvider).getProviderStatuses()).find(
              status => status.provider === 'deel',
            )?.businessId ?? null,
        };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Failed to save Deel credentials';
        console.error('setDeelCredentials error:', e);
        return { __typename: 'CommonError' as const, message };
      }
    },

    setProviderBusiness: async (_parent, { provider, businessId }, { injector }) => {
      try {
        const updatedAt = await injector
          .get(ProviderCredentialsProvider)
          .setProviderBusiness(GQL_TO_DB[provider], businessId ?? null);

        return {
          __typename: 'ProviderCredentialResult' as const,
          id: provider,
          provider,
          configuredAt: new Date(updatedAt),
          businessId: businessId ?? null,
        };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Failed to set provider business';
        console.error('setProviderBusiness error:', e);
        return { __typename: 'CommonError' as const, message };
      }
    },

    deleteProviderCredentials: async (_parent, { provider }, { injector }) => {
      try {
        await injector.get(ProviderCredentialsProvider).deleteCredentials(GQL_TO_DB[provider]);
        return {
          __typename: 'ProviderCredentialDeleteResult' as const,
          id: provider,
          provider,
          success: true,
        };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Failed to delete provider credentials';
        console.error('deleteProviderCredentials error:', e);
        return { __typename: 'CommonError' as const, message };
      }
    },
  },
};
