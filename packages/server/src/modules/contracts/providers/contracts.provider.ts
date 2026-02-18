import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
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
    SELECT fe.owner_id, c.id, c.client_id, c.start_date, c.end_date, c.remarks, c.document_type, c.amount, c.currency, c.billing_cycle, c.product, c.plan, c.is_active, c.signed_agreement, c.ms_cloud, c.purchase_orders, c.operations_count
    FROM accounter_schema.clients_contracts c
    LEFT JOIN accounter_schema.financial_entities fe ON c.client_id = fe.id
    WHERE fe.owner_id IN $$adminBusinessIds;`;

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
        $clientId,
        client_id
      ),
      purchase_orders = COALESCE(
        $purchaseOrders,
        purchase_orders
      ),
      start_date = COALESCE(
        $startDate,
        start_date
      ),
      end_date = COALESCE(
        $endDate,
        end_date
      ),
      remarks = COALESCE(
        $remarks,
        remarks
      ),
      document_type = COALESCE(
        $documentType,
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
        $billingCycle,
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
        $isActive,
        is_active
      ),
      ms_cloud = COALESCE(
        $msCloud,
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
  constructor(
    private db: TenantAwareDBClient,
    private businessesProvider: BusinessesProvider,
  ) {}

  private allOpenContractsCache: Promise<IGetAllOpenContractsResult[]> | null = null;
  public getAllOpenContracts() {
    if (this.allOpenContractsCache) {
      return this.allOpenContractsCache;
    }
    this.allOpenContractsCache = getAllOpenContracts.run(undefined, this.db).then(contracts => {
      if (contracts) {
        contracts.map(contract => {
          this.getContractsByIdLoader.prime(contract.id, contract);
        });
      }
      return contracts;
    });
    return this.allOpenContractsCache;
  }

  private async contractsByIds(ids: readonly string[]) {
    const contracts = await getContractsByIds.run({ ids }, this.db);
    return ids.map(id => contracts.find(contract => contract.id === id));
  }

  public getContractsByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.contractsByIds(ids),
  );

  private async contractsByAdminBusinessIds(adminBusinessIds: readonly string[]) {
    const contracts = await getContractsByAdminBusinessIds.run({ adminBusinessIds }, this.db);

    contracts.map(contract => {
      this.getContractsByIdLoader.prime(contract.id, contract);
    });

    return adminBusinessIds.map(adminBusinessId =>
      contracts.filter(contract => contract.owner_id === adminBusinessId),
    );
  }

  public getContractsByAdminBusinessIdLoader = new DataLoader(
    (adminBusinessIds: readonly string[]) => this.contractsByAdminBusinessIds(adminBusinessIds),
  );

  private async contractsByClients(clientIds: readonly string[]) {
    const contracts = await getContractsByClientIds.run({ clientIds }, this.db);
    contracts.map(contract => {
      this.getContractsByIdLoader.prime(contract.id, contract);
    });
    return clientIds.map(clientId => contracts.filter(contract => contract.client_id === clientId));
  }

  public getContractsByClientIdLoader = new DataLoader((ids: readonly string[]) =>
    this.contractsByClients(ids),
  );

  public async createContract(params: IInsertContractParams) {
    const [newContract] = await insertContract.run(params, this.db);
    this.getContractsByIdLoader.prime(newContract.id, newContract);

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
    const [updatedContract] = await updateContract.run(params, this.db);
    if (params.contractId) {
      await this.invalidateCacheForContract(params.contractId);
    } else {
      this.clearCache();
    }
    this.getContractsByIdLoader.prime(updatedContract.id, updatedContract);
    return updatedContract;
  }

  public async deleteContract(contractId: string) {
    await deleteContract.run({ id: contractId }, this.db);
    await this.invalidateCacheForContract(contractId);
    return true;
  }

  public async invalidateCacheForContract(contractId: string) {
    const contract = await this.getContractsByIdLoader.load(contractId);
    if (contract) {
      this.getContractsByClientIdLoader.clear(contract.client_id);
      const business = await this.businessesProvider.getBusinessByIdLoader.load(contract.client_id);
      if (business?.owner_id) {
        this.getContractsByAdminBusinessIdLoader.clear(business.owner_id);
      }
    }
    this.allOpenContractsCache = null;
  }

  public clearCache() {
    this.getContractsByAdminBusinessIdLoader.clearAll();
    this.getContractsByClientIdLoader.clearAll();
    this.getContractsByIdLoader.clearAll();
    this.allOpenContractsCache = null;
  }
}
