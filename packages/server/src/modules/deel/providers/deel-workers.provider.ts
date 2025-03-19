import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetEmployeeIDsByDeelIdsQuery,
  IGetEmployeeIdsByDocumentIdsQuery,
  IInsertDeelEmployeeParams,
  IInsertDeelEmployeeQuery,
} from '../types.js';

const getEmployeeIDsByDeelIds = sql<IGetEmployeeIDsByDeelIdsQuery>`
  SELECT *
  FROM accounter_schema.deel_employees
  WHERE id in $$deelIds;`;

const getEmployeeIdsByDocumentIds = sql<IGetEmployeeIdsByDocumentIdsQuery>`
  SELECT dd.document_id, de.business_id
  FROM accounter_schema.deel_documents dd
  LEFT JOIN accounter_schema.deel_employees de
    ON dd.deel_worker_id = de.id
  WHERE document_id in $$documentIds;`;

const insertDeelEmployee = sql<IInsertDeelEmployeeQuery>`
      INSERT INTO accounter_schema.deel_employees (
        id,
        business_id
      )
      VALUES (
        $deelId,
        $businessId
      )
      RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DeelWorkersProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchEmployeeIDsByDeelIds(deelIds: readonly number[]) {
    const employeeIDs = await getEmployeeIDsByDeelIds.run({ deelIds }, this.dbProvider);
    return deelIds.map(id => {
      const businessId = employeeIDs.find(employee => employee.id === id)?.business_id;
      if (!businessId) {
        throw new Error(`Missing businessId for Deel worker ID [${id}]`);
      }
      return businessId;
    });
  }

  public getEmployeeIDByDeelIdLoader = new DataLoader(
    (workerIds: readonly number[]) => this.batchEmployeeIDsByDeelIds(workerIds),
    {
      cacheKeyFn: key => `worker-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchEmployeeIdsByDocumentIds(documentIds: readonly string[]) {
    const employeeMatches = await getEmployeeIdsByDocumentIds.run({ documentIds }, this.dbProvider);
    return documentIds.map(
      documentId =>
        employeeMatches.find(match => match.document_id === documentId)?.business_id ?? null,
    );
  }

  public getEmployeeIdByDocumentIdLoader = new DataLoader(
    (documentIds: readonly string[]) => this.batchEmployeeIdsByDocumentIds(documentIds),
    {
      cacheKeyFn: key => `employee-by-document-${key}`,
      cacheMap: this.cache,
    },
  );

  public async insertDeelEmployee(params: IInsertDeelEmployeeParams) {
    try {
      // invalidate cache
      return insertDeelEmployee.run(params, this.dbProvider);
    } catch (e) {
      const message = `Error inserting Deel employee [${params.deelId}]`;
      console.error(message, e);
      throw new Error(message);
    }
  }
}
