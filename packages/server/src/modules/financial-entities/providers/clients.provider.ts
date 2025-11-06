import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import { validateClientIntegrations } from '../helpers/clients.helper.js';
import type {
  IDeleteClientQuery,
  IGetAllClientsQuery,
  IGetAllClientsResult,
  IGetClientsByGreenInvoiceIdsQuery,
  IGetClientsByIdsQuery,
  IInsertClientParams,
  IInsertClientQuery,
  IUpdateClientParams,
  IUpdateClientQuery,
} from '../types.js';

const getAllClients = sql<IGetAllClientsQuery>`
  SELECT *
  FROM accounter_schema.clients;
`;

const getClientsByIds = sql<IGetClientsByIdsQuery>`
  SELECT *
  FROM accounter_schema.clients
  WHERE business_id IN $$businessIds;
`;

const getClientsByGreenInvoiceIds = sql<IGetClientsByGreenInvoiceIdsQuery>`
  SELECT *, (integrations->>'greenInvoiceId')::uuid as green_invoice_business_id
  FROM accounter_schema.clients
  WHERE (integrations->>'greenInvoiceId')::uuid in $$greenInvoiceBusinessIds;
`;

const updateClient = sql<IUpdateClientQuery>`
  UPDATE accounter_schema.clients
  SET
  emails = COALESCE(
    $emails,
    emails,
    NULL
  ),
  business_id = COALESCE(
    $newBusinessId,
    business_id,
    NULL
  ),
  integrations = COALESCE(
    $integrations,
    integrations,
    NULL
  )
  WHERE
    business_id = $businessId
  RETURNING *;
`;

const deleteClient = sql<IDeleteClientQuery>`
  DELETE FROM accounter_schema.clients
  WHERE business_id = $businessId
  RETURNING business_id;
`;

const insertClient = sql<IInsertClientQuery>`
    INSERT INTO accounter_schema.clients (business_id, emails, integrations)
    VALUES ($businessId, $emails, $integrations)
    RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ClientsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 24, // 24 hours
  });

  constructor(private dbProvider: DBProvider) {}

  public async getAllClients() {
    const cache = this.cache.get<IGetAllClientsResult[]>('all-clients');
    if (cache) {
      return Promise.resolve(cache);
    }
    return getAllClients.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-clients', data);
      data.map(client => {
        this.cache.set(`client-id-${client.business_id}`, client);
        try {
          const { greenInvoiceId } = validateClientIntegrations(client.integrations ?? {});
          this.cache.set(`client-green-invoice-id-${greenInvoiceId}`, client);
        } catch {
          // swallow errors
        }
      });
      return data;
    });
  }

  private async batchClientsByIds(ids: readonly string[]) {
    try {
      const matches = await getClientsByIds.run({ businessIds: ids }, this.dbProvider);

      return ids.map(id => matches.find(match => match.business_id === id));
    } catch (e) {
      console.error(e);
      return ids.map(() => undefined);
    }
  }

  public getClientByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchClientsByIds(keys),
    {
      cacheKeyFn: key => `client-id-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchClientsByGreenInvoiceIds(greenInvoiceIds: readonly string[]) {
    try {
      const matches = await getClientsByGreenInvoiceIds.run(
        { greenInvoiceBusinessIds: greenInvoiceIds },
        this.dbProvider,
      );

      return greenInvoiceIds.map(id =>
        matches.find(match => match.green_invoice_business_id === id),
      );
    } catch (e) {
      console.error(e);
      return greenInvoiceIds.map(() => undefined);
    }
  }

  public getClientByGreenInvoiceIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchClientsByGreenInvoiceIds(keys),
    {
      cacheKeyFn: key => `client-green-invoice-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public async updateClient(params: IUpdateClientParams) {
    this.clearCache();
    return updateClient.run(params, this.dbProvider);
  }

  public async deleteClient(businessId: string) {
    this.clearCache();
    return deleteClient.run({ businessId }, this.dbProvider);
  }

  public async insertClient(params: IInsertClientParams) {
    this.clearCache();
    return insertClient.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
