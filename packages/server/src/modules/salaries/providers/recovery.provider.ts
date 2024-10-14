import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetRecoveryDataQuery, IGetRecoveryDataResult } from '../types.js';

const getRecoveryData = sql<IGetRecoveryDataQuery>`
    SELECT *
    FROM accounter_schema.recovery;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class RecoveryProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getRecoveryData() {
    const cached = this.cache.get<IGetRecoveryDataResult[]>('recovery');
    if (cached) {
      return Promise.resolve(cached);
    }

    return getRecoveryData.run(undefined, this.dbProvider).then(res => {
      this.cache.set('recovery', res);
      return res;
    });
  }

  public clearCache() {
    this.cache.clear();
  }
}
