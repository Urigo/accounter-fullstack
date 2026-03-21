import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { buildMaskedSummary } from '../helpers/masking.js';
import { extractScraperError } from '../helpers/scraper-error.js';
import {
  WorkspaceSettingsProvider,
  type SourceConnectionRow,
  type WorkspaceSettingsRow,
} from '../providers/workspace-settings.provider.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In compiled dist: resolvers/ -> workspace-settings/ -> modules/ -> src/ -> server/ -> dist/ -> packages/server/ -> packages/ -> repo root
const REPO_ROOT = path.resolve(__dirname, '../../../../../../../..');
const SCRAPER_SRC = path.join(REPO_ROOT, 'packages/scraper-local-app/src/index.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx');

/** Maps source connection credentials to env var names the scraper-local-app reads */
function buildScraperEnv(provider: string, credentials: Record<string, string>): Record<string, string> | null {
  switch (provider) {
    case 'mizrahi':
      return {
        MIZRAHI_USERNAME: credentials['username'] ?? '',
        MIZRAHI_PASSWORD: credentials['password'] ?? '',
        SCRAPE_PROVIDERS: 'mizrahi',
      };
    case 'isracard':
      return {
        ISRACARD_ALT_ID: credentials['id'] ?? '',
        ISRACARD_ALT_PASSWORD: credentials['password'] ?? '',
        ISRACARD_ALT_6_DIGITS: credentials['last6Digits'] ?? '',
        SCRAPE_PROVIDERS: 'isracard-alt',
      };
    case 'hapoalim':
      return null; // Hapoalim requires phone verification - not automatable via env
    default:
      return null;
  }
}

interface ResolverContext {
  injector: Injector;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const workspaceSettingsResolvers: Record<string, any> = {
  Query: {
    dashboardStats: async (
      _parent: unknown,
      _args: unknown,
      { injector }: ResolverContext,
    ) => {
      const provider = injector.get(WorkspaceSettingsProvider);
      return provider.getDashboardStats();
    },

    workspaceSettings: async (
      _parent: unknown,
      _args: unknown,
      { injector }: ResolverContext,
    ) => {
      try {
        const settings = await injector.get(WorkspaceSettingsProvider).getWorkspaceSettings();
        return settings ?? null;
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error fetching workspace settings:', e);
        throw new GraphQLError('Error fetching workspace settings');
      }
    },
    sourceConnections: async (
      _parent: unknown,
      _args: unknown,
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(WorkspaceSettingsProvider).getSourceConnections();
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error fetching source connections:', e);
        throw new GraphQLError('Error fetching source connections');
      }
    },
    sourceConnection: async (
      _parent: unknown,
      { id }: { id: string },
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(WorkspaceSettingsProvider).getSourceConnectionById(id);
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error fetching source connection:', e);
        throw new GraphQLError('Error fetching source connection');
      }
    },
  },
  Mutation: {
    updateWorkspaceSettings: async (
      _parent: unknown,
      {
        input,
      }: {
        input: {
          companyName?: string;
          logoUrl?: string;
          defaultCurrency?: string;
          agingThresholdDays?: number;
          matchingToleranceAmount?: number;
          billingCurrency?: string;
          billingPaymentTermsDays?: number;
        };
      },
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(WorkspaceSettingsProvider).upsertWorkspaceSettings(input);
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error updating workspace settings:', e);
        throw new GraphQLError('Error updating workspace settings');
      }
    },
    createSourceConnection: async (
      _parent: unknown,
      {
        input,
      }: {
        input: {
          provider: string;
          displayName: string;
          accountIdentifier?: string;
          credentialsJson?: string;
          financialAccountId?: string;
        };
      },
      { injector }: ResolverContext,
    ) => {
      try {
        let credentials: Record<string, string> | null = null;
        if (input.credentialsJson) {
          credentials = JSON.parse(input.credentialsJson) as Record<string, string>;
        }
        return await injector.get(WorkspaceSettingsProvider).createSourceConnection({
          provider: input.provider.toLowerCase(),
          displayName: input.displayName,
          accountIdentifier: input.accountIdentifier ?? null,
          credentials,
          financialAccountId: input.financialAccountId ?? null,
        });
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error creating source connection:', e);
        throw new GraphQLError('Error creating source connection');
      }
    },
    updateSourceConnection: async (
      _parent: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          displayName?: string;
          accountIdentifier?: string;
          credentialsJson?: string;
          status?: string;
          financialAccountId?: string;
        };
      },
      { injector }: ResolverContext,
    ) => {
      try {
        let credentials: Record<string, string> | null = null;
        if (input.credentialsJson) {
          credentials = JSON.parse(input.credentialsJson) as Record<string, string>;
        }
        return await injector.get(WorkspaceSettingsProvider).updateSourceConnection(id, {
          displayName: input.displayName ?? null,
          accountIdentifier: input.accountIdentifier ?? null,
          credentials,
          status: input.status?.toLowerCase() ?? null,
          financialAccountId: input.financialAccountId ?? null,
        });
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error updating source connection:', e);
        throw new GraphQLError('Error updating source connection');
      }
    },
    deleteSourceConnection: async (
      _parent: unknown,
      { id }: { id: string },
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(WorkspaceSettingsProvider).deleteSourceConnection(id);
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error deleting source connection:', e);
        throw new GraphQLError('Error deleting source connection');
      }
    },
    saveSourceCredentials: async (
      _parent: unknown,
      { id, credentialsJson }: { id: string; credentialsJson: string },
      { injector }: ResolverContext,
    ) => {
      try {
        const credentials = JSON.parse(credentialsJson) as Record<string, string>;
        return await injector
          .get(WorkspaceSettingsProvider)
          .updateSourceConnection(id, {
            credentials,
            displayName: null,
            accountIdentifier: null,
            status: null,
            financialAccountId: null,
          });
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error saving credentials:', e);
        throw new GraphQLError('Error saving credentials');
      }
    },
    uploadWorkspaceLogo: async (
      _parent: unknown,
      { fileBase64, mimeType }: { fileBase64: string; mimeType: string },
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(WorkspaceSettingsProvider).uploadLogo(fileBase64, mimeType);
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error uploading workspace logo:', e);
        throw new GraphQLError('Error uploading workspace logo');
      }
    },
    removeWorkspaceLogo: async (
      _parent: unknown,
      _args: unknown,
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(WorkspaceSettingsProvider).removeLogo();
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error removing workspace logo:', e);
        throw new GraphQLError('Error removing workspace logo');
      }
    },
    clearSourceCredentials: async (
      _parent: unknown,
      { id }: { id: string },
      { injector }: ResolverContext,
    ) => {
      try {
        const provider = injector.get(WorkspaceSettingsProvider);
        const conn = await provider.getSourceConnectionById(id);
        if (!conn) throw new GraphQLError('Source connection not found');
        return await provider.updateSourceConnection(id, {
          credentials: null,
          displayName: null,
          accountIdentifier: null,
          status: 'disconnected',
          financialAccountId: null,
        });
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error clearing credentials:', e);
        throw new GraphQLError('Error clearing credentials');
      }
    },

    triggerSourceSync: async (
      _parent: unknown,
      { id }: { id: string },
      { injector }: ResolverContext,
    ) => {
      const wsProvider = injector.get(WorkspaceSettingsProvider);
      const conn = await wsProvider.getSourceConnectionById(id);
      if (!conn) throw new GraphQLError('Source connection not found');

      const credentials = await wsProvider.getDecryptedCredentials(id);
      if (!credentials) {
        throw new GraphQLError('No credentials configured for this source. Add credentials first.');
      }

      const scraperEnv = buildScraperEnv(conn.provider, credentials);
      if (!scraperEnv) {
        throw new GraphQLError(
          `Automated sync is not supported for provider "${conn.provider}". Run the scraper manually.`,
        );
      }

      const spawnEnv = {
        ...process.env,
        ...scraperEnv,
      };

      try {
        await wsProvider.updateSyncStatus(id, 'active', null);

        await execFileAsync(TSX_BIN, [SCRAPER_SRC], {
          env: spawnEnv,
          cwd: path.join(REPO_ROOT, 'packages/scraper-local-app'),
          timeout: 10 * 60 * 1000, // 10 minute max
        });

        await wsProvider.updateSyncStatus(id, 'active', null);
        return { success: true, message: 'Sync completed successfully' };
      } catch (e) {
        console.error(`Scraper failed for ${conn.provider}:`, e);
        const message = extractScraperError(e);
        await wsProvider.updateSyncStatus(id, 'error', message).catch(() => null);
        return { success: false, message: `Sync failed: ${message}` };
      }
    },
  },
  WorkspaceSettings: {
    id: (row: WorkspaceSettingsRow) => row.id,
    ownerId: (row: WorkspaceSettingsRow) => row.owner_id,
    companyName: (row: WorkspaceSettingsRow) => row.company_name,
    logoUrl: (row: WorkspaceSettingsRow) => row.logo_url,
    defaultCurrency: (row: WorkspaceSettingsRow) => row.default_currency,
    agingThresholdDays: (row: WorkspaceSettingsRow) => row.aging_threshold_days,
    matchingToleranceAmount: (row: WorkspaceSettingsRow) =>
      row.matching_tolerance_amount === null || row.matching_tolerance_amount === undefined
        ? null
        : Number(row.matching_tolerance_amount),
    billingCurrency: (row: WorkspaceSettingsRow) => row.billing_currency,
    billingPaymentTermsDays: (row: WorkspaceSettingsRow) => row.billing_payment_terms_days,
    createdAt: (row: WorkspaceSettingsRow) => row.created_at,
    updatedAt: (row: WorkspaceSettingsRow) => row.updated_at,
  },
  SourceConnection: {
    id: (row: SourceConnectionRow) => row.id,
    ownerId: (row: SourceConnectionRow) => row.owner_id,
    provider: (row: SourceConnectionRow) => row.provider.toUpperCase(),
    displayName: (row: SourceConnectionRow) => row.display_name,
    accountIdentifier: (row: SourceConnectionRow) => row.account_identifier,
    status: (row: SourceConnectionRow) => row.status.toUpperCase(),
    hasCredentials: (row: SourceConnectionRow) => row.credentials_encrypted !== null,
    credentialsSummary: async (
      row: SourceConnectionRow,
      _args: unknown,
      { injector }: ResolverContext,
    ) => {
      let credentials: Record<string, string> | null = null;
      if (row.credentials_encrypted) {
        try {
          credentials = await injector
            .get(WorkspaceSettingsProvider)
            .getDecryptedCredentials(row.id);
        } catch {
          // If decryption fails, return field definitions without values
        }
      }
      return buildMaskedSummary(row.provider, credentials);
    },
    lastSyncAt: (row: SourceConnectionRow) => row.last_sync_at,
    lastSyncError: (row: SourceConnectionRow) => row.last_sync_error,
    financialAccountId: (row: SourceConnectionRow) => row.financial_account_id,
    createdAt: (row: SourceConnectionRow) => row.created_at,
    updatedAt: (row: SourceConnectionRow) => row.updated_at,
  },
};
