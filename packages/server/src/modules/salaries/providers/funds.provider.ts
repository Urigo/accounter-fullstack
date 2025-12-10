import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
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
  scope: Scope.Singleton,
  global: true,
})
export class FundsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllPensionFunds() {
    const cached = this.cache.get<IGetAllTrainingFundsResult[]>('pension-funds');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllPensionFunds.run(undefined, this.dbProvider).then(res => {
      if (res) this.cache.set('pension-funds', res);
      return res;
    });
  }

  public getAllTrainingFunds() {
    const cached = this.cache.get<IGetAllTrainingFundsResult[]>('training-funds');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllTrainingFunds.run(undefined, this.dbProvider).then(res => {
      if (res) this.cache.set('training-funds', res);
      return res;
    });
  }

  public getAllFunds(params: IGetAllFundsParams) {
    const cached = this.cache.get<IGetAllTrainingFundsResult[]>('all-funds');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllFunds.run(params, this.dbProvider).then(res => {
      if (res) this.cache.set('all-funds', res);
      return res;
    });
  }

  public clearCache() {
    this.cache.clear();
  }
}
