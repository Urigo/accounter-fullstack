import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  accountant_status,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGenerateChargeParams,
  IGenerateChargeQuery,
  IGetTempChargesByIdsQuery,
  IGetTempChargesByIdsResult,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
  IUpdateChargeParams,
  IUpdateChargeQuery,
} from '../types.js';

const getTempChargesByIds = sql<IGetTempChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

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
  )
  WHERE
    id = $chargeId
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
  INSERT INTO accounter_schema.charges (owner_id, type, is_property, accountant_status, user_description, tax_category_id, optional_vat)
  VALUES ($ownerId, $type, $isProperty, $accountantStatus, $userDescription, $taxCategoryId, $optionalVAT)
  RETURNING *;
`;

// const getChargesByFilters = sql<IGetChargesByFiltersQuery>`
//   SELECT
//     ec.*,
//     ABS(ec.event_amount) as abs_event_amount
//   FROM accounter_schema.charges c
//   LEFT JOIN accounter_schema.charges ec
//     ON c.id = ec.id
//   WHERE
//   ($isIDs = 0 OR c.id IN $$IDs)
//   AND ($isOwnerIds = 0 OR c.owner_id IN $$ownerIds)
//   AND ($isBusinessIds = 0 OR ec.business_array && $businessIds)
//   AND ($fromDate ::TEXT IS NULL OR COALESCE(ec.documents_min_date, ec.transactions_min_event_date)::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
//   AND ($fromAnyDate ::TEXT IS NULL OR GREATEST(ec.documents_max_date, ec.transactions_max_event_date, ec.transactions_max_debit_date, ec.ledger_max_invoice_date, ec.ledger_max_value_date)::TEXT::DATE >= date_trunc('day', $fromAnyDate ::DATE))
//   AND ($toDate ::TEXT IS NULL OR COALESCE(ec.documents_max_date, ec.transactions_max_event_date)::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
//   AND ($toAnyDate ::TEXT IS NULL OR LEAST(ec.documents_min_date, ec.transactions_min_event_date, ec.transactions_min_debit_date, ec.ledger_min_invoice_date, ec.ledger_min_value_date)::TEXT::DATE <= date_trunc('day', $toAnyDate ::DATE))
//   AND ($chargeType = 'ALL' OR ($chargeType = 'INCOME' AND ec.transactions_event_amount > 0) OR ($chargeType = 'EXPENSE' AND ec.transactions_event_amount <= 0))
//   AND ($withoutInvoice = FALSE OR COALESCE(ec.invoices_count, 0) = 0)
//   AND ($withoutDocuments = FALSE OR COALESCE(ec.documents_count, 0) = 0)
//   AND ($withoutLedger = FALSE OR COALESCE(ec.ledger_count, 0) = 0)
//   AND ($isAccountantStatuses = 0 OR ec.accountant_status = ANY ($accountantStatuses::accounter_schema.accountant_status[]))
//   AND ($isTags = 0 OR ec.tags && $tags)
//   ORDER BY
//   CASE WHEN $asc = true AND $sortColumn = 'event_date' THEN COALESCE(ec.documents_min_date, ec.transactions_min_debit_date, ec.transactions_min_event_date, ec.ledger_min_value_date, ec.ledger_min_invoice_date)  END ASC,
//   CASE WHEN $asc = false AND $sortColumn = 'event_date'  THEN COALESCE(ec.documents_min_date, ec.transactions_min_debit_date, ec.transactions_min_event_date, ec.ledger_min_value_date, ec.ledger_min_invoice_date)  END DESC,
//   CASE WHEN $asc = true AND $sortColumn = 'event_amount' THEN ec.event_amount  END ASC,
//   CASE WHEN $asc = false AND $sortColumn = 'event_amount'  THEN ec.event_amount  END DESC,
//   CASE WHEN $asc = true AND $sortColumn = 'abs_event_amount' THEN ABS(cast(ec.event_amount as DECIMAL))  END ASC,
//   CASE WHEN $asc = false AND $sortColumn = 'abs_event_amount'  THEN ABS(cast(ec.event_amount as DECIMAL))  END DESC;
//   `;

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TempChargesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchChargesByIds(ids: readonly string[]) {
    const charges = (await getTempChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    )) as IGetTempChargesByIdsResult[];
    return ids.map(id => charges.find(charge => charge.id === id));
  }

  public getTempChargeByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByIds(keys),
    {
      cacheKeyFn: key => `charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateCharge(params: IUpdateChargeParams) {
    if (params.chargeId) {
      this.clearChargeCache(params.chargeId);
    }
    return updateCharge.run(params, this.dbProvider).then(charges => {
      if (charges.length > 0) {
        charges.map(charge => this.cache.set(charge.id, charge));
      }
      return charges;
    });
  }

  public updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    if (params.chargeId) {
      this.clearChargeCache(params.chargeId);
    }
    return updateAccountantApproval.run(params, this.dbProvider).then(charges => {
      if (charges.length > 0) {
        charges.map(charge => this.cache.set(charge.id, charge));
      }
      return charges;
    });
  }

  public generateCharge(params: IGenerateChargeParams) {
    const fullParams = {
      isProperty: false,
      userDescription: null,
      optionalVAT: false,
      accountantStatus: 'UNAPPROVED' as accountant_status,
      ...params,
    };
    return generateCharge.run(fullParams, this.dbProvider).then(charges => {
      if (charges.length > 0) {
        charges.map(charge => this.cache.set(charge.id, charge));
      }
      return charges;
    });
  }

  // public getChargesByFilters(params: IGetAdjustedChargesByFiltersParams) {
  //   const isOwnerIds = !!params?.ownerIds?.filter(Boolean).length;
  //   const isBusinessIds = !!params?.businessIds?.filter(Boolean).length;
  //   const isIDs = !!params?.IDs?.length;
  //   const isTags = !!params?.tags?.length;
  //   const isAccountantStatuses = !!params?.accountantStatuses?.length;

  //   const defaults = {
  //     asc: false,
  //     sortColumn: 'event_date',
  //   };

  //   const fullParams: IGetChargesByFiltersParams = {
  //     ...defaults,
  //     isOwnerIds: isOwnerIds ? 1 : 0,
  //     isBusinessIds: isBusinessIds ? 1 : 0,
  //     isIDs: isIDs ? 1 : 0,
  //     isTags: isTags ? 1 : 0,
  //     isAccountantStatuses: isAccountantStatuses ? 1 : 0,
  //     ...params,
  //     fromDate: params.fromDate ?? null,
  //     toDate: params.toDate ?? null,
  //     ownerIds: isOwnerIds ? params.ownerIds! : [null],
  //     businessIds: isBusinessIds ? (params.businessIds! as string[]) : null,
  //     IDs: isIDs ? params.IDs! : [null],
  //     tags: isTags ? (params.tags! as string[]) : null,
  //     chargeType: params.chargeType ?? 'ALL',
  //     withoutInvoice: params.withoutInvoice ?? false,
  //     withoutDocuments: params.withoutDocuments ?? false,
  //     withoutLedger: params.withoutLedger ?? false,
  //     accountantStatuses: isAccountantStatuses ? params.accountantStatuses! : null,
  //   };
  //   return getChargesByFilters.run(fullParams, this.dbProvider) as Promise<
  //     IGetChargesByFiltersResult[]
  //   >;
  // }

  public deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    params.chargeIds.map(id => (id ? this.clearChargeCache(id) : null));
    return deleteChargesByIds.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }

  public clearChargeCache(id: string) {
    this.cache.delete(`charge-${id}`);
  }
}
