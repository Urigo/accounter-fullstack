import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteFinancialEntityQuery,
  IGetAllFinancialEntitiesQuery,
  IGetAllFinancialEntitiesResult,
  IGetFinancialEntitiesByIdsQuery,
  IInsertFinancialEntitiesParams,
  IInsertFinancialEntitiesQuery,
  IReplaceFinancialEntitiesQuery,
  IUpdateFinancialEntityParams,
  IUpdateFinancialEntityQuery,
} from '../types.js';
import { BusinessesOperationProvider } from './businesses-operation.provider.js';
import { BusinessesProvider } from './businesses.provider.js';
import { TaxCategoriesProvider } from './tax-categories.provider.js';

const getFinancialEntitiesByIds = sql<IGetFinancialEntitiesByIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_entities
    WHERE id IN $$ids;`;

const getAllFinancialEntities = sql<IGetAllFinancialEntitiesQuery>`
    SELECT *
    FROM accounter_schema.financial_entities;`;

const updateFinancialEntity = sql<IUpdateFinancialEntityQuery>`
  UPDATE accounter_schema.financial_entities
  SET
  name = COALESCE(
    $name,
    name
  ),
  owner_id = COALESCE(
    $ownerId,
    owner_id
  ),
  sort_code = COALESCE(
    $sortCode,
    sort_code
  ),
  type = COALESCE(
    $type,
    type
  ),
  irs_code = COALESCE(
    $irsCode,
    irs_code
  )
  WHERE
    id = $financialEntityId
  RETURNING *;
`;

const insertFinancialEntities = sql<IInsertFinancialEntitiesQuery>`
  INSERT INTO accounter_schema.financial_entities (type, owner_id, name, sort_code, irs_code)
  VALUES $$financialEntities(type, ownerId, name, sortCode, irsCode)
  RETURNING *;`;

const deleteFinancialEntity = sql<IDeleteFinancialEntityQuery>`
    DELETE FROM accounter_schema.financial_entities
    WHERE id = $financialEntityId
    RETURNING id;
  `;

const replaceFinancialEntities = sql<IReplaceFinancialEntitiesQuery>`
  WITH ledger_debit1 AS (
    UPDATE accounter_schema.ledger_records
    SET debit_entity1 = $targetEntityId
    WHERE debit_entity1 = $entityIdToReplace
    RETURNING id
  ),
  ledger_debit2 AS (
    UPDATE accounter_schema.ledger_records
    SET debit_entity2 = $targetEntityId
    WHERE debit_entity2 = $entityIdToReplace
    RETURNING id
  ),
  ledger_credit1 AS (
    UPDATE accounter_schema.ledger_records
    SET credit_entity1 = $targetEntityId
    WHERE credit_entity1 = $entityIdToReplace
    RETURNING id
  ),
  ledger_credit2 AS (
    UPDATE accounter_schema.ledger_records
    SET credit_entity2 = $targetEntityId
    WHERE credit_entity2 = $entityIdToReplace
    RETURNING id
  ),
  misc_expenses_creditor AS (
    UPDATE accounter_schema.misc_expenses
    SET creditor_id = $targetEntityId
    WHERE creditor_id = $entityIdToReplace
    RETURNING id
  )
  UPDATE accounter_schema.misc_expenses
    SET debtor_id = $targetEntityId
    WHERE debtor_id = $entityIdToReplace
  RETURNING id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class FinancialEntitiesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(
    private dbProvider: DBProvider,
    private businessesProvider: BusinessesProvider,
    private businessesOperationProvider: BusinessesOperationProvider,
    private taxCategoriesProvider: TaxCategoriesProvider,
  ) {}

  private async batchFinancialEntitiesByIds(ids: readonly string[]) {
    const financialEntities = await getFinancialEntitiesByIds.run(
      {
        ids,
      },
      this.dbProvider,
    );
    return ids.map(id => financialEntities.find(fe => fe.id === id));
  }

  public getFinancialEntityByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFinancialEntitiesByIds(keys),
    {
      cacheKeyFn: key => `financial-entity-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public getAllFinancialEntities() {
    const data = this.cache.get('all-financial-entities');
    if (data) {
      return data as Array<IGetAllFinancialEntitiesResult>;
    }
    return getAllFinancialEntities.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-financial-entities', data);
      data.map(fe => {
        this.cache.set(`financial-entity-id-${fe.id}`, fe);
      });
      return data;
    });
  }

  public updateFinancialEntity(params: IUpdateFinancialEntityParams) {
    if (params.financialEntityId) {
      this.invalidateFinancialEntityById(params.financialEntityId);
    }
    return updateFinancialEntity.run(params, this.dbProvider);
  }

  public insertFinancialEntity(
    params: IInsertFinancialEntitiesParams['financialEntities'][number],
  ) {
    this.cache.delete('all-financial-entities');
    return insertFinancialEntities.run({ financialEntities: [params] }, this.dbProvider);
  }

  private async batchInsertFinancialEntities(
    newFinancialEntities: readonly IInsertFinancialEntitiesParams['financialEntities'][number][],
  ) {
    const financialEntities = await insertFinancialEntities.run(
      {
        financialEntities: newFinancialEntities,
      },
      this.dbProvider,
    );
    return newFinancialEntities.map(fe => financialEntities.find(f => f.name === fe.name) ?? null);
  }

  public insertFinancialEntitiesLoader = new DataLoader(
    (financialEntities: readonly IInsertFinancialEntitiesParams['financialEntities'][number][]) =>
      this.batchInsertFinancialEntities(financialEntities),
    {
      cache: false,
    },
  );

  public async deleteFinancialEntityById(financialEntityId: string) {
    const entity = await this.getFinancialEntityByIdLoader.load(financialEntityId);
    if (!entity) {
      throw new Error(`Financial entity with id ${financialEntityId} not found`);
    }
    if (entity.id === entity.owner_id) {
      throw new Error('Cannot delete owner entity');
    }

    this.invalidateFinancialEntityById(financialEntityId);

    // remove business
    const deleteBusiness =
      entity.type === 'business'
        ? this.businessesOperationProvider.deleteBusinessById(financialEntityId)
        : Promise.resolve();

    // remove tax category
    const deleteTaxCategory =
      entity.type === 'tax_category'
        ? this.taxCategoriesProvider.deleteTaxCategoryById(financialEntityId)
        : Promise.resolve();

    await Promise.all([deleteBusiness, deleteTaxCategory]);

    // TODO: should remove ledger, misc expenses?

    // delete entity
    deleteFinancialEntity.run({ financialEntityId }, this.dbProvider);
  }

  public async replaceFinancialEntity(
    targetEntityId: string,
    entityIdToReplace: string,
    deleteEntity: boolean = false,
  ) {
    const [entityToReplace, entity] = await Promise.all([
      this.getFinancialEntityByIdLoader.load(entityIdToReplace),
      this.getFinancialEntityByIdLoader.load(targetEntityId),
    ]);
    if (!entityToReplace) {
      throw new Error(`Financial entity with id ${entityIdToReplace} not found`);
    }
    if (!entity) {
      throw new Error(`Financial entity with id ${targetEntityId} not found`);
    }
    if (entityToReplace.type !== entity.type) {
      throw new Error('Cannot replace entities of different types');
    }
    if (entity.id === entity.owner_id) {
      throw new Error('Cannot replace owner entity');
    }
    this.invalidateFinancialEntityById(entityIdToReplace);
    this.invalidateFinancialEntityById(targetEntityId);

    // convert ledger, misc expenses
    await replaceFinancialEntities.run({ targetEntityId, entityIdToReplace }, this.dbProvider);

    // convert business
    const businessReplacementPromise =
      entity.type === 'business'
        ? this.businessesProvider.replaceBusiness(targetEntityId, entityIdToReplace).then(() => {
            if (deleteEntity)
              this.businessesOperationProvider.deleteBusinessById(entityIdToReplace);
          })
        : Promise.resolve();

    // convert tax category
    const taxCategoryReplacementPromise =
      entity.type === 'tax_category'
        ? this.taxCategoriesProvider.replaceTaxCategory(
            targetEntityId,
            entityIdToReplace,
            deleteEntity,
          )
        : Promise.resolve();

    await Promise.all([businessReplacementPromise, taxCategoryReplacementPromise]);

    if (deleteEntity) {
      await this.deleteFinancialEntityById(entityIdToReplace);
    }
  }

  public invalidateFinancialEntityById(financialEntityId: string) {
    this.businessesProvider.invalidateBusinessById(financialEntityId);
    this.taxCategoriesProvider.invalidateTaxCategoryById(financialEntityId);
    this.cache.delete('all-financial-entities');
    this.cache.delete(`financial-entity-id-${financialEntityId}`);
  }

  public clearCache() {
    this.taxCategoriesProvider.clearCache();
    this.businessesProvider.clearCache();
    this.cache.clear();
  }
}
