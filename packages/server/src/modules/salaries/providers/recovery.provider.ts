import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type { IGetRecoveryDataQuery, IGetRecoveryDataResult } from '../types.js';

const getRecoveryData = sql<IGetRecoveryDataQuery>`
    SELECT *
    FROM accounter_schema.recovery;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class RecoveryProvider {
  constructor(private dbProvider: DBProvider) {}

  private recoveryDataCache: Promise<IGetRecoveryDataResult[]> | null = null;
  public getRecoveryData() {
    if (this.recoveryDataCache) {
      return this.recoveryDataCache;
    }

    this.recoveryDataCache = getRecoveryData.run(undefined, this.dbProvider);
    return this.recoveryDataCache;
  }

  public clearCache() {
    this.recoveryDataCache = null;
  }
}
