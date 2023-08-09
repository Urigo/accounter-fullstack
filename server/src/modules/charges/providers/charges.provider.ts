import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { sql } from '@pgtyped/runtime';
import type { Optional, TimelessDateString } from '@shared/types';
import type {
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGenerateChargeParams,
  IGenerateChargeQuery,
  IGenerateChargeResult,
  IGetChargesByFiltersParams,
  IGetChargesByFiltersQuery,
  IGetChargesByFiltersResult,
  IGetChargesByFinancialAccountIdsParams,
  IGetChargesByFinancialAccountIdsQuery,
  IGetChargesByFinancialAccountIdsResult,
  IGetChargesByFinancialEntityIdsParams,
  IGetChargesByFinancialEntityIdsQuery,
  IGetChargesByFinancialEntityIdsResult,
  IGetChargesByIdsQuery,
  IGetChargesByIdsResult, // IGetConversionOtherSideParams,
  // IGetConversionOtherSideQuery,
  IUpdateChargeParams,
  IUpdateChargeQuery,
  IUpdateChargeResult,
} from '../types.js';

export type ChargeRequiredWrapper<
  T extends {
    id: unknown;
    owner_id: unknown;
    is_conversion: unknown;
    is_property: unknown;
    accountant_reviewed: unknown;
  },
> = Omit<T, 'id' | 'owner_id' | 'is_conversion' | 'is_property' | 'accountant_reviewed'> & {
  id: NonNullable<T['id']>;
  owner_id: NonNullable<T['owner_id']>;
  is_conversion: NonNullable<T['is_conversion']>;
  is_property: NonNullable<T['is_property']>;
  accountant_reviewed: NonNullable<T['accountant_reviewed']>;
};

const getChargesByIds = sql<IGetChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.extended_charges
    WHERE id IN $$chargeIds;`;

const getChargesByFinancialAccountIds = sql<IGetChargesByFinancialAccountIdsQuery>`
    SELECT c.*, t.account_id
    FROM accounter_schema.extended_charges c
    LEFT JOIN accounter_schema.transactions t
    ON c.id = t.charge_id
    WHERE c.id IN (
      SELECT charge_id
      FROM accounter_schema.transactions
      WHERE account_id IN $$financialAccountIDs
      AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
      AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    )
    AND t.event_date = (
      SELECT MIN(event_date)
      FROM accounter_schema.transactions as t2
      WHERE t2.charge_id = c.id
    )
    ORDER BY t.event_date DESC;`;

const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT c.*
    FROM accounter_schema.extended_charges c
    LEFT JOIN accounter_schema.transactions t
    ON c.id = t.charge_id
    WHERE owner_id IN $$ownerIds
    AND t.event_date = (
      SELECT MIN(event_date)
      FROM accounter_schema.transactions as t2
      WHERE t2.charge_id = c.id
    )
    AND ($fromDate ::TEXT IS NULL OR t.event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR t.event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY t.event_date DESC;`;

// const getConversionOtherSide = sql<IGetConversionOtherSideQuery>`
//     SELECT event_amount, currency_code
//     FROM accounter_schema.all_transactions
//     WHERE bank_reference = $bankReference
//       AND id <> $chargeId
//       LIMIT 1;`;

const updateCharge = sql<IUpdateChargeQuery>`
  UPDATE accounter_schema.charges
  SET
  owner_id = COALESCE(
    $ownerId,
    owner_id
  ),
  user_description = COALESCE(
    $userDescription,
    user_description
  ),
  is_conversion = COALESCE(
    $isConversion,
    is_conversion
  ),
  is_property = COALESCE(
    $isProperty,
    is_property
  ),
  accountant_reviewed = COALESCE(
    $accountantReviewed,
    accountant_reviewed
  ),
  tax_category_id = COALESCE(
    $taxCategoryId,
    tax_category_id
  )
  WHERE
    id = $chargeId
  RETURNING *;
`;

const generateCharge = sql<IGenerateChargeQuery>`
  INSERT INTO accounter_schema.charges (owner_id, is_conversion, is_property, accountant_reviewed, user_description)
  VALUES ($ownerId, $isConversion, $isProperty, $accountantReviewed, $userDescription)
  RETURNING *;
`;

const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
  SELECT
    c.*,
    ABS(c.event_amount) as abs_event_amount
  FROM accounter_schema.extended_charges c
  WHERE 
  ($isIDs = 0 OR c.id IN $$IDs)
  AND ($isOwnerIds = 0 OR c.owner_id IN $$ownerIds)
  AND ($isBusinessIds = 0 OR c.business_id IN $$businessIds)
  AND ($fromDate ::TEXT IS NULL OR COALESCE(c.documents_min_date, c.transactions_min_event_date)::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
  AND ($toDate ::TEXT IS NULL OR COALESCE(c.documents_max_date, c.transactions_max_event_date)::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
  AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND c.transactions_event_amount > 0) OR ($chargeType = 'EXPENSE' AND c.transactions_event_amount <= 0))
  ORDER BY
  CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN COALESCE(c.documents_min_date, c.transactions_min_event_date)  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_date'  THEN COALESCE(c.documents_min_date, c.transactions_min_event_date)  END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN c.event_amount  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_amount'  THEN c.event_amount  END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(c.event_amount as DECIMAL))  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount'  THEN ABS(cast(c.event_amount as DECIMAL))  END DESC;
  `;

type IGetAdjustedChargesByFiltersParams = Optional<
  Omit<IGetChargesByFiltersParams, 'isOwnerIds' | 'isBusinessIds' | 'isIDs'>,
  'ownerIds' | 'businessIds' | 'IDs' | 'asc' | 'sortColumn' | 'toDate' | 'fromDate'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
};

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ChargesProvider {
  constructor(
    private dbProvider: DBProvider,
    private businessProvider: FinancialEntitiesProvider,
  ) {}

  private async batchChargesByIds(ids: readonly string[]) {
    const charges = (await getChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByIdsResult>[];
    return ids.map(id => charges.find(charge => charge.id === id));
  }

  public getChargeByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByIds(keys),
    { cache: false },
  );

  public getChargesByFinancialAccountIds(params: IGetChargesByFinancialAccountIdsParams) {
    return getChargesByFinancialAccountIds.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IGetChargesByFinancialAccountIdsResult>[]
    >;
  }

  private async batchChargesByFinancialAccountIds(financialAccountIDs: readonly string[]) {
    const charges = (await getChargesByFinancialAccountIds.run(
      {
        financialAccountIDs,
        fromDate: null,
        toDate: null,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByFinancialAccountIdsResult>[];
    return financialAccountIDs.map(accountId =>
      charges.filter(charge => charge.account_id === accountId),
    );
  }

  public getChargeByFinancialAccountIDsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByFinancialAccountIds(keys),
    {
      cache: false,
    },
  );

  public getChargesByFinancialEntityIds(params: IGetChargesByFinancialEntityIdsParams) {
    return getChargesByFinancialEntityIds.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IGetChargesByFinancialEntityIdsResult>[]
    >;
  }

  private async batchChargesByFinancialEntityIds(ownerIds: readonly string[]) {
    const charges = (await getChargesByFinancialEntityIds.run(
      {
        ownerIds,
        fromDate: null,
        toDate: null,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByFinancialEntityIdsResult>[];
    return ownerIds.map(id => charges.filter(charge => charge.owner_id === id));
  }

  public getChargeByFinancialEntityIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByFinancialEntityIds(keys),
    {
      cache: false,
    },
  );

  // public getConversionOtherSide(params: IGetConversionOtherSideParams) {
  //   return getConversionOtherSide.run(params, this.dbProvider);
  // }

  public updateCharge(params: IUpdateChargeParams) {
    return updateCharge.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IUpdateChargeResult>[]
    >;
  }

  public generateCharge(params: IGenerateChargeParams) {
    const fullParams = {
      accountantReviewed: false,
      isConversion: false,
      isProperty: false,
      userDescription: null,
      ...params,
    };
    return generateCharge.run(fullParams, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IGenerateChargeResult>[]
    >;
  }

  public getChargesByFilters(params: IGetAdjustedChargesByFiltersParams) {
    const isOwnerIds = !!params?.ownerIds?.filter(Boolean).length;
    const isBusinessIds = !!params?.businessIds?.filter(Boolean).length;
    const isIDs = !!params?.IDs?.length;

    const defaults = {
      asc: false,
      sortColumn: 'event_date',
    };

    const fullParams: IGetChargesByFiltersParams = {
      ...defaults,
      isOwnerIds: isOwnerIds ? 1 : 0,
      isBusinessIds: isBusinessIds ? 1 : 0,
      isIDs: isIDs ? 1 : 0,
      ...params,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      ownerIds: isOwnerIds ? params.ownerIds! : [null],
      businessIds: isBusinessIds ? params.businessIds! : [null],
      IDs: isIDs ? params.IDs! : [null],
      chargeType: params.chargeType ?? 'ALL',
    };
    return getChargesByFilters.run(fullParams, this.dbProvider) as Promise<
      IGetChargesByFiltersResult[]
    >;
  }

  public deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    return deleteChargesByIds.run(params, this.dbProvider);
  }
}
