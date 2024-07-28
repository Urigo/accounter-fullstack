import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetEmployeesByEmployerQuery } from '../types.js';

const getEmployeesByEmployer = sql<IGetEmployeesByEmployerQuery>`
    SELECT *
    FROM accounter_schema.employees
    WHERE employer in $$employerIDs;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class EmployeesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchEmployeesByEmployerIDs(employerIDs: readonly string[]) {
    if (employerIDs.length) {
      return getEmployeesByEmployer
        .run({ employerIDs }, this.dbProvider)
        .then(res =>
          employerIDs.map(employerId => res.filter(employee => employee.employer === employerId)),
        );
    }
    return [];
  }

  public getEmployeesByEmployerLoader = new DataLoader(
    (employerIDs: readonly string[]) => this.batchEmployeesByEmployerIDs(employerIDs),
    {
      cacheKeyFn: key => `salary-employer-${key}`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
