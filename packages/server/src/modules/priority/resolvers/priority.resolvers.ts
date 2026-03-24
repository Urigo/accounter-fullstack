import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { PriorityClientProvider } from '../../app-providers/priority/priority-client.provider.js';
import { PriorityCSVImportProvider } from '../providers/priority-csv-import.provider.js';
import { PriorityInvoicesProvider } from '../providers/priority-invoices.provider.js';

interface ResolverContext {
  injector: Injector;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const priorityResolvers: Record<string, any> = {
  Query: {
    priorityInvoices: async (
      _: unknown,
      { filter }: { filter?: { custname?: string; currency?: string; ivtype?: string } | null },
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(PriorityInvoicesProvider).getInvoices(filter ?? {});
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        console.error('Error fetching Priority invoices:', e);
        throw new GraphQLError('Error fetching Priority invoices');
      }
    },
  },

  Mutation: {
    testPriorityConnection: async (_: unknown, __: unknown, { injector }: ResolverContext) => {
      try {
        return await injector.get(PriorityClientProvider).testConnection();
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Unknown error' };
      }
    },

    importPriorityCSV: async (
      _: unknown,
      { csvContent }: { csvContent: string },
      { injector }: ResolverContext,
    ) => {
      try {
        return await injector.get(PriorityCSVImportProvider).importCSV(csvContent);
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        const message = e instanceof Error ? e.message : 'Import failed';
        console.error('Error importing Priority CSV:', e);
        throw new GraphQLError(`Priority CSV import failed: ${message}`);
      }
    },

    syncPriorityInvoices: async (
      _: unknown,
      { input }: { input?: { fromDate?: string | null; pageSize?: number | null } | null },
      { injector }: ResolverContext,
    ) => {
      try {
        const client = injector.get(PriorityClientProvider);
        const provider = injector.get(PriorityInvoicesProvider);

        const queryOptions: Record<string, unknown> = {};
        if (input?.fromDate) {
          queryOptions.$filter = `CURDATE ge ${input.fromDate}T00:00:00+00:00`;
        }
        if (input?.pageSize) {
          queryOptions.$top = input.pageSize;
        }

        const invoices = await client.getInvoices(queryOptions);
        if (invoices.length === 0) {
          return { synced: 0, skipped: 0, errors: 0, message: 'No invoices found in Priority' };
        }

        const sourceConnectionId = await provider.getSourceConnectionId();
        const { synced, errors } = await provider.upsertInvoices(invoices, sourceConnectionId);

        if (sourceConnectionId) {
          await provider.updateSourceConnectionStatus(
            sourceConnectionId,
            errors > 0 ? 'error' : 'active',
          );
        }

        return {
          synced,
          skipped: 0,
          errors,
          message: `Synced ${synced} invoices from Priority${errors > 0 ? ` (${errors} errors)` : ''}`,
        };
      } catch (e) {
        if (e instanceof GraphQLError) throw e;
        const message = e instanceof Error ? e.message : 'Sync failed';
        console.error('Error syncing Priority invoices:', e);
        throw new GraphQLError(`Priority sync failed: ${message}`);
      }
    },
  },

  PriorityInvoice: {
    id: (row: { id: string }) => row.id,
    ownerId: (row: { owner_id: string }) => row.owner_id,
    ivnum: (row: { ivnum: string }) => row.ivnum,
    ivtype: (row: { ivtype: string | null }) => row.ivtype,
    custname: (row: { custname: string | null }) => row.custname,
    custVatid: (row: { cust_vatid: string | null }) => row.cust_vatid,
    curdate: (row: { curdate: Date | null }) => row.curdate,
    duedate: (row: { duedate: Date | null }) => row.duedate,
    details: (row: { details: string | null }) => row.details,
    currency: (row: { currency: string | null }) => row.currency,
    netAmount: (row: { net_amount: string | null }) =>
      row.net_amount != null ? parseFloat(row.net_amount) : null,
    vat: (row: { vat: string | null }) => (row.vat != null ? parseFloat(row.vat) : null),
    total: (row: { total: string | null }) =>
      row.total != null ? parseFloat(row.total) : null,
    discount: (row: { discount: string | null }) =>
      row.discount != null ? parseFloat(row.discount) : null,
    paid: (row: { paid: string | null }) => (row.paid != null ? parseFloat(row.paid) : null),
    balance: (row: { balance: string | null }) =>
      row.balance != null ? parseFloat(row.balance) : null,
    statdes: (row: { statdes: string | null }) => row.statdes,
    syncedAt: (row: { synced_at: Date }) => row.synced_at,
    createdAt: (row: { created_at: Date }) => row.created_at,
    updatedAt: (row: { updated_at: Date }) => row.updated_at,
  },
};
