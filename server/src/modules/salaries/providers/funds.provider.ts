import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { IGetAllPensionFundsQuery, IGetAllTrainingFundsQuery } from '../types.js';

const getAllPensionFunds = sql<IGetAllPensionFundsQuery>`
    SELECT *
    FROM accounter_schema.pension_funds
    WHERE accounter_schema.pension_funds.type = 'pension';`;

const getAllTrainingFunds = sql<IGetAllTrainingFundsQuery>`
    SELECT *
    FROM accounter_schema.pension_funds
    WHERE accounter_schema.pension_funds.type = 'training_fund';`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FundsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllPensionFunds() {
    return getAllPensionFunds.run(undefined, this.dbProvider);
  }

  public getAllTrainingFunds() {
    return getAllTrainingFunds.run(undefined, this.dbProvider);
  }
}
