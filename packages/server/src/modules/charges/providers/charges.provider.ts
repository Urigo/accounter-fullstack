import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { Optional, TimelessDateString } from '@shared/types';
import type {
  accountant_status,
  IBatchUpdateChargesParams,
  IBatchUpdateChargesQuery,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGenerateChargeParams,
  IGenerateChargeQuery,
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
  IGetChargesByIdsResult,
  IGetChargesByMissingRequiredInfoQuery,
  IGetChargesByTransactionIdsQuery,
  IGetChargesByTransactionIdsResult,
  IGetSimilarChargesParams,
  IGetSimilarChargesQuery,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
  IUpdateAccountantApprovalResult,
  IUpdateChargeParams,
  IUpdateChargeQuery,
  IUpdateChargeResult,
} from '../types.js';

export type ChargeRequiredWrapper<
  T extends {
    id: unknown;
    owner_id: unknown;
    is_property: unknown;
    accountant_status: unknown;
    updated_at: unknown;
    created_at: unknown;
  },
> = Omit<
  T,
  'id' | 'owner_id' | 'is_property' | 'accountant_status' | 'updated_at' | 'created_at'
> & {
  id: NonNullable<T['id']>;
  owner_id: NonNullable<T['owner_id']>;
  is_property: NonNullable<T['is_property']>;
  accountant_status: NonNullable<T['accountant_status']>;
  updated_at: NonNullable<T['updated_at']>;
  created_at: NonNullable<T['created_at']>;
};

const getChargesByIds = sql<IGetChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.extended_charges
    WHERE id IN $$chargeIds;`;

const getChargesByTransactionIds = sql<IGetChargesByTransactionIdsQuery>`
    SELECT t.id AS transaction_id, c.* FROM accounter_schema.transactions t
    LEFT JOIN accounter_schema.extended_charges c
      ON t.charge_id = c.id
    WHERE t.id IN $$transactionIds;`;

const getChargesByFinancialAccountIds = sql<IGetChargesByFinancialAccountIdsQuery>`
    SELECT c.*, t.account_id
    FROM accounter_schema.extended_charges c
    LEFT JOIN accounter_schema.transactions t
    ON c.id = t.charge_id AND t.event_date = c.transactions_min_event_date
    WHERE c.id IN (
      SELECT charge_id
      FROM accounter_schema.transactions
      WHERE account_id IN $$financialAccountIDs
      AND ($fromDate ::TEXT IS NULL OR transactions_max_event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
      AND ($toDate ::TEXT IS NULL OR transactions_min_event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    )
    ORDER BY t.event_date DESC;`;

const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT c.*
    FROM accounter_schema.extended_charges c
    WHERE owner_id IN $$ownerIds
    AND ($fromDate ::TEXT IS NULL OR c.transactions_max_event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR c.transactions_min_event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    ORDER BY c.transactions_min_event_date DESC;`;

const getChargesByMissingRequiredInfo = sql<IGetChargesByMissingRequiredInfoQuery>`
    SELECT c.*
    FROM accounter_schema.charges c
    LEFT JOIN accounter_schema.charge_tags t
      ON t.charge_id = c.id
    WHERE c.user_description IS NULL
    OR t.tag_id IS NULL;`;

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
  type = COALESCE(
    $type,
    type
  ),
  is_property = COALESCE(
    $isProperty,
    is_property
  ),
  invoice_payment_currency_diff = COALESCE(
    $isInvoicePaymentDifferentCurrency,
    invoice_payment_currency_diff
  ),
  accountant_status = COALESCE(
    $accountantStatus,
    accountant_status
  ),
  tax_category_id = COALESCE(
    $taxCategoryId,
    tax_category_id
  ),
  optional_vat = COALESCE(
    $optionalVAT,
    optional_vat
  ),
  documents_optional_flag = COALESCE(
    $optionalDocuments,
    documents_optional_flag
  )
  WHERE
    id = $chargeId
  RETURNING *;
`;

const batchUpdateCharges = sql<IBatchUpdateChargesQuery>`
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
  type = COALESCE(
    $type,
    type
  ),
  is_property = COALESCE(
    $isProperty,
    is_property
  ),
  invoice_payment_currency_diff = COALESCE(
    $isInvoicePaymentDifferentCurrency,
    invoice_payment_currency_diff
  ),
  accountant_status = COALESCE(
    $accountantStatus,
    accountant_status
  ),
  tax_category_id = COALESCE(
    $taxCategoryId,
    tax_category_id
  ),
  optional_vat = COALESCE(
    $optionalVAT,
    optional_vat
  ),
  documents_optional_flag = COALESCE(
    $optionalDocuments,
    documents_optional_flag
  )
  WHERE
    id in $$chargeIds
  RETURNING *;
`;

const updateAccountantApproval = sql<IUpdateAccountantApprovalQuery>`
  UPDATE accounter_schema.charges
  SET
    accountant_status = $accountantStatus
  WHERE
    id = $chargeId
  RETURNING *;
`;

const generateCharge = sql<IGenerateChargeQuery>`
  INSERT INTO accounter_schema.charges (owner_id, type, is_property, accountant_status, user_description, tax_category_id, optional_vat, documents_optional_flag)
  VALUES ($ownerId, $type, $isProperty, $accountantStatus, $userDescription, $taxCategoryId, $optionalVAT, $optionalDocuments)
  RETURNING *;
`;

const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
  SELECT
    ec.*,
    ABS(ec.event_amount) as abs_event_amount
  FROM accounter_schema.charges c
  LEFT JOIN accounter_schema.extended_charges ec
    ON c.id = ec.id
  WHERE 
  ($isIDs = 0 OR c.id IN $$IDs)
  AND ($isOwnerIds = 0 OR c.owner_id IN $$ownerIds)
  AND ($isBusinessIds = 0 OR ec.business_array && $businessIds)
  AND ($fromDate ::TEXT IS NULL OR COALESCE(ec.documents_min_date, ec.transactions_min_event_date)::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
  AND ($fromAnyDate ::TEXT IS NULL OR GREATEST(ec.documents_max_date, ec.transactions_max_event_date, ec.transactions_max_debit_date, ec.ledger_max_invoice_date, ec.ledger_max_value_date)::TEXT::DATE >= date_trunc('day', $fromAnyDate ::DATE))
  AND ($toDate ::TEXT IS NULL OR COALESCE(ec.documents_max_date, ec.transactions_max_event_date)::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
  AND ($toAnyDate ::TEXT IS NULL OR LEAST(ec.documents_min_date, ec.transactions_min_event_date, ec.transactions_min_debit_date, ec.ledger_min_invoice_date, ec.ledger_min_value_date)::TEXT::DATE <= date_trunc('day', $toAnyDate ::DATE))
  AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND ec.transactions_event_amount > 0) OR ($chargeType = 'EXPENSE' AND ec.transactions_event_amount <= 0))
  AND ($withoutInvoice = FALSE OR COALESCE(ec.invoices_count, 0) = 0)
  AND ($withoutReceipt = FALSE OR (COALESCE(ec.receipts_count, 0) = 0 AND (ec.no_invoices_required IS FALSE)))
  AND ($withoutDocuments = FALSE OR COALESCE(ec.documents_count, 0) = 0)
  AND ($withoutTransactions = FALSE OR COALESCE(ec.transactions_count, 0) = 0)
  AND ($withoutLedger = FALSE OR COALESCE(ec.ledger_count, 0) = 0)
  AND ($isAccountantStatuses = 0 OR ec.accountant_status = ANY ($accountantStatuses::accounter_schema.accountant_status[]))
  AND ($isTags = 0 OR ec.tags && $tags)
  ORDER BY
  CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN (COALESCE(ec.documents_min_date, ec.transactions_min_debit_date, ec.transactions_min_event_date, ec.ledger_min_value_date, ec.ledger_min_invoice_date), COALESCE(ec.transactions_min_event_date, ec.documents_min_date), ec.id)  END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_date'  THEN (COALESCE(ec.documents_min_date, ec.transactions_min_debit_date, ec.transactions_min_event_date, ec.ledger_min_value_date, ec.ledger_min_invoice_date), COALESCE(ec.transactions_min_event_date, ec.documents_min_date), ec.id)  END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN (ec.event_amount, ec.id) END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'event_amount'  THEN (ec.event_amount, ec.id) END DESC,
  CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(ec.event_amount as DECIMAL)) END ASC,
  CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount'  THEN ABS(cast(ec.event_amount as DECIMAL)) END DESC, ID;
  `;

const getSimilarCharges = sql<IGetSimilarChargesQuery>`
      SELECT *
      FROM accounter_schema.extended_charges
      WHERE (CASE WHEN $withMissingTags IS TRUE THEN
        tags IS NULL
     ELSE
        TRUE
     END)
        AND (CASE WHEN $withMissingDescription IS TRUE THEN
        user_description IS NULL
     ELSE
        TRUE
     END)
        AND (CASE WHEN $tagsDifferentThan::UUID[] IS NOT NULL THEN
        NOT((tags @> $tagsDifferentThan) AND (tags <@ $tagsDifferentThan))
     ELSE
        TRUE
     END)
        AND (CASE WHEN $descriptionDifferentThan::TEXT IS NOT NULL THEN
        NOT(user_description = $descriptionDifferentThan)
     ELSE
        TRUE
     END)
        AND (
          (business_id IS NOT NULL AND business_id = $businessId)
          OR (business_array IS NOT NULL AND business_array @> $businessArray AND business_array <@ $businessArray)
        ) AND owner_id = $ownerId
     ORDER BY (COALESCE(documents_min_date, transactions_min_debit_date, transactions_min_event_date, ledger_min_value_date, ledger_min_invoice_date), COALESCE(transactions_min_event_date, documents_min_date), id) DESC;`;

type IGetAdjustedChargesByFiltersParams = Optional<
  Omit<
    IGetChargesByFiltersParams,
    'isOwnerIds' | 'isBusinessIds' | 'businessIds' | 'isIDs' | 'isTags' | 'tags'
  >,
  'ownerIds' | 'IDs' | 'asc' | 'sortColumn' | 'toDate' | 'fromDate'
> & {
  toDate?: TimelessDateString | null;
  fromDate?: TimelessDateString | null;
  tags?: readonly string[] | null;
  businessIds?: readonly string[] | null;
};

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ChargesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchChargesByIds(ids: readonly string[]) {
    const charges = (await getChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByIdsResult>[];
    return ids.map(id => {
      const charge = charges.find(charge => charge.id === id);
      if (!charge) {
        return new Error(`Charge ID="${id}" not found`);
      }
      return charge;
    });
  }

  public getChargeByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByIds(keys),
    { cache: false },
  );

  private async batchChargesByTransactionIds(transactionIds: readonly string[]) {
    const charges = (await getChargesByTransactionIds.run(
      {
        transactionIds,
      },
      this.dbProvider,
    )) as ChargeRequiredWrapper<IGetChargesByTransactionIdsResult>[];
    return transactionIds.map(id => charges.find(charge => charge.transaction_id === id));
  }

  public getChargeByTransactionIdLoader = new DataLoader(
    (transactionIds: readonly string[]) => this.batchChargesByTransactionIds(transactionIds),
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

  public async getChargesByMissingRequiredInfo() {
    return getChargesByMissingRequiredInfo.run(undefined, this.dbProvider);
  }

  public updateCharge(params: IUpdateChargeParams) {
    return updateCharge.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IUpdateChargeResult>[]
    >;
  }

  public batchUpdateCharges(params: IBatchUpdateChargesParams) {
    return batchUpdateCharges.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IUpdateChargeResult>[]
    >;
  }

  public updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    return updateAccountantApproval.run(params, this.dbProvider) as Promise<
      ChargeRequiredWrapper<IUpdateAccountantApprovalResult>[]
    >;
  }

  public generateCharge(params: IGenerateChargeParams) {
    const fullParams = {
      isProperty: false,
      userDescription: null,
      optionalVAT: false,
      optionalDocuments: false,
      accountantStatus: 'UNAPPROVED' as accountant_status,
      ...params,
    };
    return generateCharge.run(fullParams, this.dbProvider);
  }

  public getChargesByFilters(params: IGetAdjustedChargesByFiltersParams) {
    const isOwnerIds = !!params?.ownerIds?.filter(Boolean).length;
    const isBusinessIds = !!params?.businessIds?.filter(Boolean).length;
    const isIDs = !!params?.IDs?.length;
    const isTags = !!params?.tags?.length;
    const isAccountantStatuses = !!params?.accountantStatuses?.length;

    const defaults = {
      asc: false,
      sortColumn: 'event_date',
    };

    const fullParams: IGetChargesByFiltersParams = {
      ...defaults,
      isOwnerIds: isOwnerIds ? 1 : 0,
      isBusinessIds: isBusinessIds ? 1 : 0,
      isIDs: isIDs ? 1 : 0,
      isTags: isTags ? 1 : 0,
      isAccountantStatuses: isAccountantStatuses ? 1 : 0,
      ...params,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      ownerIds: isOwnerIds ? params.ownerIds! : [null],
      businessIds: isBusinessIds ? (params.businessIds! as string[]) : null,
      IDs: isIDs ? params.IDs! : [null],
      tags: isTags ? (params.tags! as string[]) : null,
      chargeType: params.chargeType ?? 'ALL',
      withoutInvoice: params.withoutInvoice ?? false,
      withoutReceipt: params.withoutReceipt ?? false,
      withoutDocuments: params.withoutDocuments ?? false,
      withoutTransactions: params.withoutTransactions ?? false,
      withoutLedger: params.withoutLedger ?? false,
      accountantStatuses: isAccountantStatuses ? params.accountantStatuses! : null,
    };
    return getChargesByFilters.run(fullParams, this.dbProvider) as Promise<
      IGetChargesByFiltersResult[]
    >;
  }

  public async getSimilarCharges(params: IGetSimilarChargesParams) {
    try {
      return getSimilarCharges.run(params, this.dbProvider) as Promise<
        IGetChargesByFiltersResult[]
      >;
    } catch (error) {
      const message = 'Failed to fetch similar charges';
      console.error(message, error);
      throw new Error(message);
    }
  }

  public deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    return deleteChargesByIds.run(params, this.dbProvider);
  }
}
