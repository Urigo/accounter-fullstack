import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetFinancialAccountsOwnershipQuery,
  IGetFinancialCreditCardAccountsByIdsQuery,
  IUpsertCreditCardSettlementAccountQuery,
} from '../types.js';

const getFinancialCreditCardAccountsByIds = sql<IGetFinancialCreditCardAccountsByIdsQuery>`
  SELECT cca.id, cca.owner_id, cca.settlement_account_id
  FROM accounter_schema.financial_credit_card_accounts cca
    JOIN accounter_schema.financial_accounts a
      ON a.id = cca.id
      AND a.owner_id = cca.owner_id
  WHERE cca.id IN $$cardAccountIds;`;

/** The tenant and type of financial accounts, for ownership checks */
const getFinancialAccountsOwnership = sql<IGetFinancialAccountsOwnershipQuery>`
  SELECT a.id, a.owner_id, a.type
  FROM accounter_schema.financial_accounts a
  WHERE a.id IN $$accountIds;`;

/**
 * Creates the card's side-table row on first write. The row takes the card account's owner, and
 * only CREDIT_CARD accounts get one.
 */
const upsertCreditCardSettlementAccount = sql<IUpsertCreditCardSettlementAccountQuery>`
  INSERT INTO accounter_schema.financial_credit_card_accounts (id, owner_id, settlement_account_id)
  SELECT a.id, a.owner_id, $settlementAccountId
  FROM accounter_schema.financial_accounts a
  WHERE a.id = $cardAccountId
    AND a.owner_id = $ownerId
    AND a.type = 'CREDIT_CARD'
  ON CONFLICT (id) DO UPDATE
    SET settlement_account_id = EXCLUDED.settlement_account_id
  RETURNING *;`;

/** The CREDIT_CARD side table: the bank account each card is debited from. */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class FinancialCreditCardAccountsProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchCreditCardAccountsByIds(cardAccountIds: readonly string[]) {
    const rows = await getFinancialCreditCardAccountsByIds.run({ cardAccountIds }, this.db);
    return cardAccountIds.map(id => rows.find(row => row.id === id));
  }

  /** A card account without a row has no settlement account */
  public getCreditCardAccountByIdLoader = new DataLoader((cardAccountIds: readonly string[]) =>
    this.batchCreditCardAccountsByIds(cardAccountIds),
  );

  public async getFinancialAccountsOwnership(accountIds: readonly string[]) {
    if (accountIds.length === 0) {
      return [];
    }
    return getFinancialAccountsOwnership.run({ accountIds }, this.db);
  }

  public async setSettlementAccount(params: {
    cardAccountId: string;
    ownerId: string;
    settlementAccountId: string | null;
  }) {
    const [row] = await upsertCreditCardSettlementAccount.run(params, this.db);
    this.getCreditCardAccountByIdLoader.clear(params.cardAccountId);
    return row;
  }
}
