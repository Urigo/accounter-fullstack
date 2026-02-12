import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetAllFundsParams,
  IGetAllFundsQuery,
  IGetAllPensionFundsQuery,
  IGetAllTrainingFundsQuery,
  IGetAllTrainingFundsResult,
} from '../types.js';

const getAllPensionFunds = sql<IGetAllPensionFundsQuery>`
    SELECT *
    FROM accounter_schema.pension_funds
    WHERE accounter_schema.pension_funds.type = 'pension';`;

const getAllTrainingFunds = sql<IGetAllTrainingFundsQuery>`
    SELECT *
    FROM accounter_schema.pension_funds
    WHERE accounter_schema.pension_funds.type = 'training_fund';`;

const getAllFunds = sql<IGetAllFundsQuery>`
  SELECT * FROM accounter_schema.pension_funds;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class FundsProvider {
  constructor(private db: TenantAwareDBClient) {}

  private pensionFundsCache: Promise<IGetAllTrainingFundsResult[]> | null = null;
  public getAllPensionFunds() {
    if (this.pensionFundsCache) {
      return this.pensionFundsCache;
    }
    this.pensionFundsCache = getAllPensionFunds.run(undefined, this.db);
    return this.pensionFundsCache;
  }

  private trainingFundsCache: Promise<IGetAllTrainingFundsResult[]> | null = null;
  public getAllTrainingFunds() {
    if (this.trainingFundsCache) {
      return this.trainingFundsCache;
    }
    this.trainingFundsCache = getAllTrainingFunds.run(undefined, this.db);
    return this.trainingFundsCache;
  }

  private allFundsCache: Promise<IGetAllTrainingFundsResult[]> | null = null;
  public getAllFunds(params: IGetAllFundsParams) {
    if (this.allFundsCache) {
      return this.allFundsCache;
    }
    this.allFundsCache = getAllFunds.run(params, this.db);
    return this.allFundsCache;
  }
}
