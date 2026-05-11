import { ProviderCredentialsProvider } from '../providers/provider-credentials.provider.js';
import type { ProviderCredentialsModule } from '../types.js';

type DbProviderKey = 'green_invoice' | 'deel';

const DB_TO_GQL: Record<DbProviderKey, ProviderCredentialsModule.ProviderKey> = {
  green_invoice: 'GREEN_INVOICE' as ProviderCredentialsModule.ProviderKey,
  deel: 'DEEL' as ProviderCredentialsModule.ProviderKey,
};

const GQL_TO_DB: Record<string, DbProviderKey> = {
  GREEN_INVOICE: 'green_invoice',
  DEEL: 'deel',
};

export const providerCredentialsResolvers: ProviderCredentialsModule.Resolvers = {
  Query: {
    providerCredentials: async (_parent, _args, { injector }) => {
      const statuses = await injector.get(ProviderCredentialsProvider).getProviderStatuses();
      return statuses.map(s => ({
        id: DB_TO_GQL[s.provider as DbProviderKey],
        provider: DB_TO_GQL[s.provider as DbProviderKey],
        configuredAt: new Date(s.configuredAt),
      }));
    },
  },

  Mutation: {
    setGreenInvoiceCredentials: async (_parent, { id, secret }, { injector }) => {
      try {
        await injector
          .get(ProviderCredentialsProvider)
          .setCredentials('green_invoice', { id, secret });

        const statuses = await injector.get(ProviderCredentialsProvider).getProviderStatuses();
        const status = statuses.find(s => s.provider === 'green_invoice');
        return {
          __typename: 'ProviderCredentialResult' as const,
          id: DB_TO_GQL['green_invoice'],
          provider: DB_TO_GQL['green_invoice'],
          configuredAt: new Date(status!.configuredAt),
        };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Failed to save Green Invoice credentials';
        console.error('setGreenInvoiceCredentials error:', e);
        return { __typename: 'CommonError' as const, message };
      }
    },

    setDeelCredentials: async (_parent, { apiToken }, { injector }) => {
      try {
        await injector.get(ProviderCredentialsProvider).setCredentials('deel', { apiToken });

        const statuses = await injector.get(ProviderCredentialsProvider).getProviderStatuses();
        const status = statuses.find(s => s.provider === 'deel');
        return {
          __typename: 'ProviderCredentialResult' as const,
          id: DB_TO_GQL['deel'],
          provider: DB_TO_GQL['deel'],
          configuredAt: new Date(status!.configuredAt),
        };
      } catch (e) {
        const message = (e as Error)?.message ?? 'Failed to save Deel credentials';
        console.error('setDeelCredentials error:', e);
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
