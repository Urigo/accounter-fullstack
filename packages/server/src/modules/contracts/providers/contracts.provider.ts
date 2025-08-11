import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetAllOpenContractsQuery, IGetAllOpenContractsResult } from '../types.js';

const getAllOpenContracts = sql<IGetAllOpenContractsQuery>`
    SELECT *
    FROM accounter_schema.clients_contracts
    WHERE is_active IS TRUE;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ContractsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60, // 1 hours
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllOpenContracts() {
    const cached = this.cache.get<IGetAllOpenContractsResult[]>('all-contracts');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllOpenContracts.run(undefined, this.dbProvider).then(contracts => {
      if (contracts) {
        this.cache.set('all-contracts', contracts);
        contracts.map(contract => {
          this.cache.set(`contract-${contract.id}`, contract);
        });
      }
      return contracts;
    });
  }

  public clearCache() {
    this.cache.clear();
  }
}
