import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  accountant_status,
  IBatchUpdateChargesParams,
  IBatchUpdateChargesQuery,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGenerateChargeParams,
  IGenerateChargeQuery,
  IGetChargesByIdsQuery,
  IGetChargesByMissingRequiredInfoQuery,
  IGetChargesByTransactionIdsQuery,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
  IUpdateChargeParams,
  IUpdateChargeQuery,
} from '../__generated__/charges-simple.types.js';

const getChargesByIds = sql<IGetChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

const getChargesByTransactionIds = sql<IGetChargesByTransactionIdsQuery>`
    SELECT t.id AS transaction_id, c.* FROM accounter_schema.transactions t
    LEFT JOIN accounter_schema.charges c
      ON t.charge_id = c.id
    WHERE t.id IN $$transactionIds;`;

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

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

const chargeIdsSet = new Set<string>();

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ChargesSimpleProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60, // 1 hours
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchChargesByIds(ids: readonly string[]) {
    ids.map(id => {
      if (chargeIdsSet.has(id)) {
        console.error(`Duplicate charge ID requested in loader: "${id}"`);
      }
      chargeIdsSet.add(id);
    });
    const charges = await getChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    );
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
    {
      cacheKeyFn: id => `charge-${id}`,
      cacheMap: this.cache,
    },
  );

  private async batchChargesByTransactionIds(transactionIds: readonly string[]) {
    const charges = await getChargesByTransactionIds.run(
      {
        transactionIds,
      },
      this.dbProvider,
    );
    charges.map(charge => this.getChargeByIdLoader.prime(charge.id, charge));
    return transactionIds.map(id => charges.find(charge => charge.transaction_id === id));
  }

  public getChargeByTransactionIdLoader = new DataLoader(
    (transactionIds: readonly string[]) => this.batchChargesByTransactionIds(transactionIds),
    {
      cacheKeyFn: id => `charge-of-transaction-${id}`,
      cacheMap: this.cache,
    },
  );

  public async getChargesByMissingRequiredInfo() {
    return getChargesByMissingRequiredInfo.run(undefined, this.dbProvider).then(charges => {
      charges.map(charge => this.getChargeByIdLoader.prime(charge.id, charge));
      return charges;
    });
  }

  public updateCharge(params: IUpdateChargeParams) {
    return updateCharge.run(params, this.dbProvider).then(([newCharge]) => {
      if (newCharge) {
        this.getChargeByIdLoader.prime(newCharge.id, newCharge);
      }
      return newCharge;
    });
  }

  public batchUpdateCharges(params: IBatchUpdateChargesParams) {
    return batchUpdateCharges.run(params, this.dbProvider).then(updatedCharges => {
      updatedCharges.map(updatedCharge => {
        this.getChargeByIdLoader.prime(updatedCharge.id, updatedCharge);
      });

      return updatedCharges;
    });
  }

  public updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    return updateAccountantApproval.run(params, this.dbProvider).then(([newCharge]) => {
      if (newCharge) {
        this.getChargeByIdLoader.prime(newCharge.id, newCharge);
      }
      return newCharge;
    });
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
    return generateCharge.run(fullParams, this.dbProvider).then(([newCharge]) => {
      if (newCharge) {
        this.getChargeByIdLoader.prime(newCharge.id, newCharge);
      }
      return newCharge;
    });
  }

  public deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    if (params.chargeIds) {
      params.chargeIds.map(id => id && this.getChargeByIdLoader.clear(id));
    }
    return deleteChargesByIds.run(params, this.dbProvider);
  }

  public invalidateCharge(chargeId: string) {
    this.getChargeByIdLoader.clear(chargeId);
  }

  public clearCache() {
    this.cache.clear();
  }
}
