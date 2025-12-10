import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import type {
  IDeleteContractQuery,
  IGetAllOpenContractsQuery,
  IGetAllOpenContractsResult,
  IGetContractsByAdminBusinessIdsQuery,
  IGetContractsByClientIdsQuery,
  IGetContractsByIdsQuery,
  IInsertContractParams,
  IInsertContractQuery,
  IUpdateContractParams,
  IUpdateContractQuery,
} from '../types.js';

const getAllOpenContracts = sql<IGetAllOpenContractsQuery>`
    SELECT *
    FROM accounter_schema.clients_contracts
    WHERE is_active IS TRUE;`;

const getContractsByIds = sql<IGetContractsByIdsQuery>`
    SELECT *
    FROM accounter_schema.clients_contracts
    WHERE id In $$ids;`;

const getContractsByAdminBusinessIds = sql<IGetContractsByAdminBusinessIdsQuery>`
    SELECT fe.owner_id, c.*
    FROM accounter_schema.clients_contracts c
    LEFT JOIN accounter_schema.financial_entities fe ON c.client_id = fe.id
    WHERE owner_id IN $$adminBusinessIds;`;

const getContractsByClientIds = sql<IGetContractsByClientIdsQuery>`
    SELECT *
    FROM accounter_schema.clients_contracts
    WHERE client_id IN $$clientIds;`;

const deleteContract = sql<IDeleteContractQuery>`
    DELETE FROM accounter_schema.clients_contracts
    WHERE id = $id;`;

const updateContract = sql<IUpdateContractQuery>`
      UPDATE accounter_schema.clients_contracts
      SET
      client_id = COALESCE(
        $client_id,
        client_id
      ),
      purchase_orders = COALESCE(
        $purchase_orders,
        purchase_orders
      ),
      start_date = COALESCE(
        $start_date,
        start_date
      ),
      end_date = COALESCE(
        $end_date,
        end_date
      ),
      remarks = COALESCE(
        $remarks,
        remarks
      ),
      document_type = COALESCE(
        $document_type,
        document_type
      ),
      amount = COALESCE(
        $amount,
        amount
      ),
      currency = COALESCE(
        $currency,
        currency
      ),
      billing_cycle = COALESCE(
        $billing_cycle,
        billing_cycle
      ),
      product = COALESCE(
        $product,
        product
      ),
      plan = COALESCE(
        $plan,
        plan
      ),
      is_active = COALESCE(
        $is_active,
        is_active
      ),
      ms_cloud = COALESCE(
        $ms_cloud,
        ms_cloud
      ),
      operations_count = COALESCE(
        $operationsLimit,
        operations_count
      )
      WHERE
        id = $contractId
      RETURNING *;
    `;

const insertContract = sql<IInsertContractQuery>`
        INSERT INTO accounter_schema.clients_contracts (
          client_id,
          purchase_orders,
          start_date,
          end_date,
          remarks,
          document_type,
          amount,
          currency,
          billing_cycle,
          product,
          plan,
          is_active,
          ms_cloud,
          operations_count
        )
        VALUES ($clientId,
          $purchaseOrders,
          $startDate,
          $endDate,
          $remarks,
          $documentType,
          $amount,
          $currency,
          $billingCycle,
          $product,
          $plan,
          $isActive,
          $msCloud,
          $operationsLimit)
        RETURNING *;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ContractsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60, // 1 hours
  });

  constructor(
    private dbProvider: DBProvider,
    private businessesProvider: BusinessesProvider,
  ) {}

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

  private async contractsByIds(ids: readonly string[]) {
    const contracts = await getContractsByIds.run({ ids }, this.dbProvider);
    return ids.map(id => contracts.find(contract => contract.id === id));
  }

  public getContractsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.contractsByIds(ids),
    {
      cacheKeyFn: id => `contract-${id}`,
      cacheMap: this.cache,
    },
  );

  private async contractsByAdminBusinessIds(adminBusinessIds: readonly string[]) {
    const contracts = await getContractsByAdminBusinessIds.run(
      { adminBusinessIds },
      this.dbProvider,
    );
    return adminBusinessIds.map(adminBusinessId =>
      contracts.filter(contract => contract.owner_id === adminBusinessId),
    );
  }

  public getContractsByAdminBusinessIdLoader = new DataLoader(
    (adminBusinessIds: readonly string[]) => this.contractsByAdminBusinessIds(adminBusinessIds),
    {
      cacheKeyFn: adminBusinessId => `admin-business-${adminBusinessId}-contracts`,
      cacheMap: this.cache,
    },
  );

  private async contractsByClients(clientIds: readonly string[]) {
    const contracts = await getContractsByClientIds.run({ clientIds }, this.dbProvider);
    return clientIds.map(clientId => contracts.filter(contract => contract.client_id === clientId));
  }

  public getContractsByClientIdLoader = new DataLoader(
    (ids: readonly string[]) => this.contractsByClients(ids),
    {
      cacheKeyFn: id => `client-contracts-${id}`,
      cacheMap: this.cache,
    },
  );

  public async createContract(params: IInsertContractParams) {
    const [newContract] = await insertContract.run(params, this.dbProvider);
    this.cache.set(`contract-${newContract.id}`, newContract);

    // Invalidate list caches
    this.getContractsByClientIdLoader.clear(newContract.client_id);
    const business = await this.businessesProvider.getBusinessByIdLoader.load(
      newContract.client_id,
    );
    if (business?.owner_id) {
      this.getContractsByAdminBusinessIdLoader.clear(business.owner_id);
    }

    return newContract;
  }

  public async updateContract(params: IUpdateContractParams) {
    const [updatedContract] = await updateContract.run(params, this.dbProvider);
    if (params.contractId) {
      this.invalidateCacheForContract(params.contractId);
    } else {
      this.clearCache();
    }
    this.cache.set(`contract-${updatedContract.id}`, updatedContract);
    return updatedContract;
  }

  public async deleteContract(contractId: string) {
    await deleteContract.run({ id: contractId }, this.dbProvider);
    this.invalidateCacheForContract(contractId);
    return true;
  }

  public async invalidateCacheForContract(contractId: string) {
    const contract = await this.getContractsByIdLoader.load(contractId);
    if (contract) {
      this.cache.delete(`client-contracts-${contract.client_id}`);
      const business = await this.businessesProvider.getBusinessByIdLoader.load(contract.client_id);
      if (business?.owner_id) {
        this.cache.delete(`admin-business-${business.owner_id}-contracts`);
      }
    }
  }

  public clearCache() {
    this.cache.clear();
  }
}
