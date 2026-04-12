// Example provider file for a GraphQL module.
// Providers are the data access layer — resolvers NEVER query the DB directly.
import DataLoader from 'dataloader';
// Injectable + Scope from graphql-modules for DI registration
import { Injectable, Scope } from 'graphql-modules';
// pgtyped `sql` tag — SQL queries with auto-generated TypeScript types
import { sql } from '@pgtyped/runtime';
// Admin context for owner ID when needed
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
// Tenant-aware DB client — scoped to the current tenant
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
// Import generated SQL query types from the module's types.ts
import type { IGetAllItemsQuery, IGetItemsByIdsQuery, IInsertItemQuery } from '../types.js';

// Define SQL queries using pgtyped's `sql` tagged template.
// Types (IGetAllItemsQuery etc.) are generated from these SQL statements — never hand-write them.
const getAllItems = sql<IGetAllItemsQuery>`
  SELECT * FROM accounter_schema.items`;

const getItemsByIds = sql<IGetItemsByIdsQuery>`
  SELECT i.*
  FROM accounter_schema.items i
  WHERE ($isItemIds = 0 OR i.id IN $$itemIds);`;

const insertItem = sql<IInsertItemQuery>`
  INSERT INTO accounter_schema.items (name, code, owner_id)
  VALUES ($name, $code, $ownerId)
  RETURNING *;`;

// Scope.Operation = one instance per GraphQL request (request-scoped)
// global: true = available to all modules via injector
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ItemsProvider {
  // Constructor injection — DI provides these automatically
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  // Optional: in-memory cache for "get all" queries within a single operation
  private allItemsCache: Promise<Awaited<ReturnType<typeof getAllItems.run>>> | null = null;

  public getAllItems() {
    if (this.allItemsCache) {
      return this.allItemsCache;
    }
    this.allItemsCache = getAllItems.run(undefined, this.db).then(data => {
      // Prime the DataLoader cache to prevent redundant fetches
      data.map(item => {
        this.getItemByIdLoader.prime(item.id, item);
      });
      return data;
    });
    return this.allItemsCache;
  }

  // DataLoader batch function — receives all requested IDs, returns results in matching order
  private async batchItemsByIds(ids: readonly string[]) {
    const items = await getItemsByIds.run(
      {
        isItemIds: ids.length > 0 ? 1 : 0,
        itemIds: ids,
      },
      this.db,
    );
    const itemsMap = new Map(items.map(item => [item.id, item]));
    return ids.map(id => itemsMap.get(id));
  }

  // Public DataLoader — resolvers call this instead of querying directly
  public getItemByIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchItemsByIds(keys),
  );

  public async addItem(params: { name: string; code: number }) {
    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertItem.run({ ...params, ownerId }, this.db);
  }

  // Always clear caches after mutations
  public clearCache() {
    this.getItemByIdLoader.clearAll();
    this.allItemsCache = null;
  }
}
