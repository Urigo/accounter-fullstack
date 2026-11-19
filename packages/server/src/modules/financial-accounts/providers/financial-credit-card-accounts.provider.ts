import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetFinancialAccountsOwnershipQuery,
  IGetFinancialCreditCardAccountsByIdsQuery,
  IGetSettlementAccountLinkCountsByCardIdsQuery,
  IUpsertCreditCardSettlementAccountQuery,
} from '../types.js';

const getFinancialCreditCardAccountsByIds = sql<IGetFinancialCreditCardAccountsByIdsQuery>`
  SELECT cca.id, cca.owner_id, cca.settlement_account_id
  FROM accounter_schema.financial_credit_card_accounts cca
    JOIN accounter_schema.financial_accounts a
      ON a.id = cca.id
      AND a.owner_id = cca.owner_id
  WHERE cca.id IN $$cardAccountIds;`;

/**
 * Per card account, the number of its stored statement links whose bank debit is on each of the
 * owner's bank accounts. Card, links, bank rows and bank accounts are all pinned to the card's
 * owner.
 */
const getSettlementAccountLinkCountsByCardIds = sql<IGetSettlementAccountLinkCountsByCardIdsQuery>`
  SELECT l.card_account_id,
    t.account_id AS bank_account_id,
    count(*)::int AS links_count
  FROM accounter_schema.creditcard_statement_links l
    JOIN accounter_schema.financial_accounts card
      ON card.id = l.card_account_id
      AND card.owner_id = l.owner_id
      AND card.type = 'CREDIT_CARD'
    JOIN accounter_schema.transactions t
      ON t.id = l.bank_transaction_id
      AND t.owner_id = l.owner_id
    JOIN accounter_schema.financial_accounts bank
      ON bank.id = t.account_id
      AND bank.owner_id = l.owner_id
      AND bank.type = 'BANK_ACCOUNT'
  WHERE l.card_account_id IN $$cardAccountIds
  GROUP BY l.card_account_id, t.account_id;`;

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

/** Fewest stored links that must agree on a bank account before it is suggested */
export const MIN_SETTLEMENT_SUGGESTION_LINKS = 2;

export type SettlementAccountSuggestion = {
  bankAccountId: string;
  /** The card's stored links whose bank debit is on that account */
  linksCount: number;
};

/**
 * The bank account holding most of a card's links, when at least
 * `MIN_SETTLEMENT_SUGGESTION_LINKS` agree and no other account holds as many.
 */
export function pickSettlementAccountSuggestion(
  counts: readonly SettlementAccountSuggestion[],
): SettlementAccountSuggestion | null {
  const sorted = [...counts].sort((a, b) => b.linksCount - a.linksCount);
  const [top, runnerUp] = sorted;
  if (!top || top.linksCount < MIN_SETTLEMENT_SUGGESTION_LINKS) {
    return null;
  }
  if (runnerUp && runnerUp.linksCount === top.linksCount) {
    return null;
  }
  return top;
}

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

  private async batchSettlementAccountSuggestionsByCardIds(cardAccountIds: readonly string[]) {
    const rows = await getSettlementAccountLinkCountsByCardIds.run({ cardAccountIds }, this.db);
    return cardAccountIds.map(id =>
      pickSettlementAccountSuggestion(
        rows
          .filter(row => row.card_account_id === id)
          .map(row => ({ bankAccountId: row.bank_account_id, linksCount: row.links_count ?? 0 })),
      ),
    );
  }

  /** The bank account most of each card's stored links are debited from, if they agree on one */
  public getSettlementAccountSuggestionByCardIdLoader = new DataLoader(
    (cardAccountIds: readonly string[]) =>
      this.batchSettlementAccountSuggestionsByCardIds(cardAccountIds),
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
