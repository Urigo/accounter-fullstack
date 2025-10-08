import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IGetEmployeeIDsByContractIdsQuery,
  IGetEmployeeIdsByDocumentIdsQuery,
  IInsertDeelContractParams,
  IInsertDeelContractQuery,
} from '../types.js';

const getEmployeeIDsByContractIds = sql<IGetEmployeeIDsByContractIdsQuery>`
  SELECT *
  FROM accounter_schema.deel_workers
  WHERE contract_id in $$contractIds;`;

const getEmployeeIdsByDocumentIds = sql<IGetEmployeeIdsByDocumentIdsQuery>`
  SELECT di.document_id, dw.business_id
  FROM accounter_schema.deel_invoices di
  LEFT JOIN accounter_schema.deel_workers dw
    ON di.contract_id = dw.contract_id
  WHERE di.document_id in $$documentIds;`;

const insertDeelContract = sql<IInsertDeelContractQuery>`
      INSERT INTO accounter_schema.deel_workers (
        contract_id,
        contractor_id,
        contractor_name,
        contract_start_date,
        business_id
      )
      VALUES (
        $contractId,
        $contractorId,
        $contractorName,
        $contractStartDate,
        $businessId
      )
      RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DeelContractsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchEmployeeIDsByContractIds(contractIds: readonly string[]) {
    const contracts = await getEmployeeIDsByContractIds.run({ contractIds }, this.dbProvider);
    return contractIds.map(id => {
      const businessId = contracts.find(contract => contract.contract_id === id)?.business_id;
      if (!businessId) {
        throw new Error(`Missing businessId for Deel contract ID [${id}]`);
      }
      return businessId;
    });
  }

  public getEmployeeIDByContractIdLoader = new DataLoader(
    (contractIds: readonly string[]) => this.batchEmployeeIDsByContractIds(contractIds),
    {
      cacheKeyFn: key => `worker-contract-${key}`,
      cacheMap: this.cache,
    },
  );
  private async batchEmployeesByContractIds(contractIds: readonly string[]) {
    const contracts = await getEmployeeIDsByContractIds.run({ contractIds }, this.dbProvider);
    return contractIds.map(id => {
      const contract = contracts.find(contract => contract.contract_id === id);
      if (!contract) {
        throw new Error(`Missing Deel contract for ID [${id}]`);
      }
      return contract;
    });
  }

  public getEmployeeByContractIdLoader = new DataLoader(
    (contractIds: readonly string[]) => this.batchEmployeesByContractIds(contractIds),
    {
      cacheKeyFn: key => `worker-contract-full-${key}`,
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

  public async insertDeelContract(params: IInsertDeelContractParams) {
    try {
      // invalidate cache
      return insertDeelContract.run(params, this.dbProvider);
    } catch (e) {
      const message = `Error inserting Deel contract [${params.contractId}]`;
      console.error(`${message}: ${e}`);
      throw new Error(message);
    }
  }
}
