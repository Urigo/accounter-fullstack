import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  accountant_status,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsQuery,
  IGenerateChargeParams,
  IGenerateChargeQuery,
  IGetMainChargesByIdsQuery,
  IGetMainChargesByIdsResult,
  IGetMainChargesByOwnerIdsParams,
  IGetMainChargesByOwnerIdsQuery,
  IGetMainChargesByOwnerIdsResult,
  IGetMainChargesByTransactionIdsQuery,
  IGetMainChargesByTransactionIdsResult,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalQuery,
  IUpdateAccountantApprovalResult,
  IUpdateChargeParams,
  IUpdateChargeQuery,
  IUpdateChargeResult,
} from '../types.js';

const getMainChargesByIds = sql<IGetMainChargesByIdsQuery>`
    SELECT *
    FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

const getMainChargesByTransactionIds = sql<IGetMainChargesByTransactionIdsQuery>`
    SELECT t.id AS transaction_id, c.* FROM accounter_schema.transactions t
    LEFT JOIN accounter_schema.charges c
      ON t.charge_id = c.id
    WHERE t.id IN $$transactionIds;`;

const getMainChargesByOwnerIds = sql<IGetMainChargesByOwnerIdsQuery>`
    SELECT c.*
    FROM accounter_schema.charges c
    WHERE owner_id IN $$ownerIds;`;

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

const deleteChargesByIds = sql<IDeleteChargesByIdsQuery>`
    DELETE FROM accounter_schema.charges
    WHERE id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class MainChargesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchChargesByIds(ids: readonly string[]) {
    const charges = (await getMainChargesByIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    )) as IGetMainChargesByIdsResult[];
    return ids.map(id => charges.find(charge => charge.id === id));
  }

  public getChargeByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByIds(keys),
    { cache: false },
  );

  private async batchChargesByTransactionIds(transactionIds: readonly string[]) {
    const charges = (await getMainChargesByTransactionIds.run(
      {
        transactionIds,
      },
      this.dbProvider,
    )) as IGetMainChargesByTransactionIdsResult[];
    return transactionIds.map(id => charges.find(charge => charge.id === id));
  }

  public getChargeByTransactionIdLoader = new DataLoader(
    (transactionIds: readonly string[]) => this.batchChargesByTransactionIds(transactionIds),
    { cache: false },
  );

  public getChargesByOwnerIds(params: IGetMainChargesByOwnerIdsParams) {
    return getMainChargesByOwnerIds.run(params, this.dbProvider) as Promise<
      IGetMainChargesByOwnerIdsResult[]
    >;
  }

  private async batchChargesByOwnerIds(ownerIds: readonly string[]) {
    const charges = (await getMainChargesByOwnerIds.run(
      {
        ownerIds,
      },
      this.dbProvider,
    )) as IGetMainChargesByOwnerIdsResult[];
    return ownerIds.map(id => charges.filter(charge => charge.owner_id === id));
  }

  public getChargeByOwnerIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchChargesByOwnerIds(keys),
    {
      cache: false,
    },
  );

  public updateCharge(params: IUpdateChargeParams) {
    return updateCharge.run(params, this.dbProvider) as Promise<IUpdateChargeResult[]>;
  }

  public updateAccountantApproval(params: IUpdateAccountantApprovalParams) {
    return updateAccountantApproval.run(params, this.dbProvider) as Promise<
      IUpdateAccountantApprovalResult[]
    >;
  }

  public generateCharge(params: IGenerateChargeParams) {
    const fullParams = {
      isProperty: false,
      userDescription: null,
      optionalVAT: false,
      accountantStatus: 'UNAPPROVED' as accountant_status,
      ...params,
    };
    return generateCharge.run(fullParams, this.dbProvider);
  }

  public deleteChargesByIds(params: IDeleteChargesByIdsParams) {
    return deleteChargesByIds.run(params, this.dbProvider);
  }
}
