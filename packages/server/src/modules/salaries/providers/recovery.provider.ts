import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { IGetRecoveryDataQuery, IGetRecoveryDataResult } from '../types.js';

const getRecoveryData = sql<IGetRecoveryDataQuery>`
    SELECT *
    FROM accounter_schema.recovery;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class RecoveryProvider {
  constructor(private db: TenantAwareDBClient) {}

  private recoveryDataCache: Promise<IGetRecoveryDataResult[]> | null = null;
  public getRecoveryData() {
    if (this.recoveryDataCache) {
      return this.recoveryDataCache;
    }

    this.recoveryDataCache = getRecoveryData.run(undefined, this.db);
    return this.recoveryDataCache;
  }

  public clearCache() {
    this.recoveryDataCache = null;
  }
}
