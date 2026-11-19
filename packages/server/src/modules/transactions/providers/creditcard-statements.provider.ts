import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import {
  STATEMENT_DATE_WINDOW_DAYS,
  statementKeyId,
  type StatementKey,
} from '../helpers/creditcard-statement-matcher.helper.js';
import type {
  creditcard_statement_link_method,
  currency,
  IDeleteCreditCardStatementLinkQuery,
  IDeleteRejectionsQuery,
  IGetAutoLinkCandidateBankTransactionIdsQuery,
  IGetBankCardHintsByTransactionIdsQuery,
  IGetBankTransactionsByChargeIdsQuery,
  IGetBankTransactionsByIdsQuery,
  IGetBankTransactionsByIdsResult,
  IGetCandidateStatementsByBankTransactionIdsQuery,
  IGetCandidateStatementsByBankTransactionIdsResult,
  IGetCardTransactionsByStatementKeysQuery,
  IGetCardTransactionsByStatementKeysResult,
  IGetCreditCardStatementLinksByBankTransactionIdsQuery,
  IGetCreditCardStatementLinksByBankTransactionIdsResult,
  IGetCreditCardStatementLinksByStatementKeysQuery,
  IGetLegacyReferenceAccountsByBankTransactionIdsQuery,
  IGetLinkedChargeIdsQuery,
  IGetRejectionsByBankTransactionIdsQuery,
  IInsertCreditCardStatementLinksQuery,
  IInsertRejectionQuery,
} from '../types.js';

/** Transactions of non-card accounts, fees aside: the bank side of a card debit. */
const getBankTransactionsByChargeIds = sql<IGetBankTransactionsByChargeIdsQuery>`
  SELECT t.id,
    t.charge_id,
    t.owner_id,
    t.account_id,
    a.type AS account_type,
    t.amount,
    t.currency,
    t.source_reference,
    t.source_description,
    t.business_id,
    t.is_fee,
    COALESCE(t.debit_date_override, t.debit_date, t.event_date) AS effective_date
  FROM accounter_schema.transactions t
    JOIN accounter_schema.financial_accounts a
      ON a.id = t.account_id
      AND a.owner_id = t.owner_id
  WHERE t.charge_id IN $$chargeIds
    AND a.type <> 'CREDIT_CARD'
    AND t.is_fee IS FALSE
  ORDER BY t.event_date, t.id;`;

const getBankTransactionsByIds = sql<IGetBankTransactionsByIdsQuery>`
  SELECT t.id,
    t.charge_id,
    t.owner_id,
    t.account_id,
    a.type AS account_type,
    t.amount,
    t.currency,
    t.source_reference,
    t.source_description,
    t.business_id,
    t.is_fee,
    COALESCE(t.debit_date_override, t.debit_date, t.event_date) AS effective_date
  FROM accounter_schema.transactions t
    JOIN accounter_schema.financial_accounts a
      ON a.id = t.account_id
      AND a.owner_id = t.owner_id
  WHERE t.id IN $$transactionIds;`;

/**
 * Card identifiers found in the banks' raw rows, one row per (bank transaction, hint).
 *
 * Supporting another bank's raw clue means adding one `UNION ALL` branch to `bank_card_hints`.
 * The generic clues every bank shares (the card number as reference, the card's name or last 4
 * digits in the description) come from the `transactions` row itself and are read by the matcher.
 */
const getBankCardHintsByTransactionIds = sql<IGetBankCardHintsByTransactionIdsQuery>`
  WITH bank AS (
    SELECT t.id, t.source_id, t.owner_id
    FROM accounter_schema.transactions t
    WHERE t.id IN $$transactionIds
  ),
  bank_card_hints AS (
    -- Poalim ILS: a card debit (activity 491) carries the card number as its reference. The raw
    -- Poalim table has no owner column: the row is reached only through the bank row own
    -- source_id, and the bank rows are those of the requested transactions
    SELECT b.id AS transaction_id,
      'POALIM_491'::text AS source,
      p.reference_number::text AS hint
    FROM bank b
      JOIN accounter_schema.transactions_raw_list rl
        ON rl.id = b.source_id
      JOIN accounter_schema.poalim_ils_account_transactions p
        ON p.id = rl.poalim_ils_id
        AND p.activity_type_code = 491
    UNION ALL
    -- Otsar Hahayal ILS: card-breakdown rows carry the last 4 digits of the card (OUT-MSKART)
    SELECT b.id AS transaction_id,
      'OTSAR_HAHAYAL_ILS'::text AS source,
      btrim(o.origin_reference) AS hint
    FROM bank b
      JOIN accounter_schema.transactions_raw_list rl
        ON rl.id = b.source_id
      JOIN accounter_schema.otsar_hahayal_ils_account_transactions o
        ON o.id = rl.otsar_hahayal_ils_id
        AND (o.owner_id = b.owner_id OR o.owner_id IS NULL)
  )
  SELECT h.transaction_id, h.source, h.hint
  FROM bank_card_hints h
  WHERE h.hint <> '' AND h.hint IS NOT NULL;`;

/**
 * Card statements around each bank transaction's date: the card rows of one card account, in the
 * bank row's currency, grouped by effective debit date, with the card's identifiers, its
 * configured settlement account and the bank transaction the statement is already linked to.
 * Everything is pinned to the bank row's owner.
 */
const getCandidateStatementsByBankTransactionIds = sql<IGetCandidateStatementsByBankTransactionIdsQuery>`
  WITH bank AS (
    SELECT t.id,
      t.owner_id,
      t.currency,
      COALESCE(t.debit_date_override, t.debit_date, t.event_date) AS effective_date
    FROM accounter_schema.transactions t
    WHERE t.id IN $$bankTransactionIds
  ),
  statements AS (
    SELECT b.id AS bank_transaction_id,
      ct.owner_id,
      ct.account_id AS card_account_id,
      ct.currency,
      COALESCE(ct.debit_date_override, ct.debit_date) AS debit_date,
      sum(ct.amount) AS total,
      count(*)::int AS transactions_count
    FROM bank b
      JOIN accounter_schema.transactions ct
        ON ct.owner_id = b.owner_id
        AND ct.currency = b.currency
        AND COALESCE(ct.debit_date_override, ct.debit_date)
          BETWEEN b.effective_date - $windowDays::int AND b.effective_date + $windowDays::int
      JOIN accounter_schema.financial_accounts ca
        ON ca.id = ct.account_id
        AND ca.owner_id = ct.owner_id
        AND ca.type = 'CREDIT_CARD'
    GROUP BY b.id, ct.owner_id, ct.account_id, ct.currency, COALESCE(ct.debit_date_override, ct.debit_date)
  )
  SELECT s.bank_transaction_id,
    s.card_account_id,
    s.currency,
    s.debit_date,
    s.total,
    s.transactions_count,
    a.account_number,
    a.account_name,
    cca.settlement_account_id,
    l.bank_transaction_id AS linked_bank_transaction_id
  FROM statements s
    JOIN accounter_schema.financial_accounts a
      ON a.id = s.card_account_id
    LEFT JOIN accounter_schema.financial_credit_card_accounts cca
      ON cca.id = s.card_account_id
      AND cca.owner_id = s.owner_id
    LEFT JOIN accounter_schema.creditcard_statement_links l
      ON l.card_account_id = s.card_account_id
      AND l.currency = s.currency
      AND l.debit_date = s.debit_date
      AND l.owner_id = s.owner_id
  ORDER BY s.debit_date, s.card_account_id;`;

const getCreditCardStatementLinksByBankTransactionIds = sql<IGetCreditCardStatementLinksByBankTransactionIdsQuery>`
  SELECT l.*
  FROM accounter_schema.creditcard_statement_links l
    JOIN accounter_schema.transactions t
      ON t.id = l.bank_transaction_id
      AND t.owner_id = l.owner_id
  WHERE l.bank_transaction_id IN $$bankTransactionIds
  ORDER BY l.debit_date, l.card_account_id;`;

const getCreditCardStatementLinksByStatementKeys = sql<IGetCreditCardStatementLinksByStatementKeysQuery>`
  SELECT l.*
  FROM accounter_schema.creditcard_statement_links l
  WHERE l.owner_id = $ownerId
    AND l.card_account_id IN $$cardAccountIds
    AND (l.card_account_id::text || '|' || l.currency::text || '|' || l.debit_date::text) IN $$statementKeys;`;

/** The charges, among the given ones, that hold a bank transaction with a stored statement link */
const getLinkedChargeIds = sql<IGetLinkedChargeIdsQuery>`
  SELECT DISTINCT t.charge_id
  FROM accounter_schema.creditcard_statement_links l
    JOIN accounter_schema.transactions t
      ON t.id = l.bank_transaction_id
      AND t.owner_id = l.owner_id
  WHERE t.charge_id IN $$chargeIds;`;

/**
 * The financial accounts of the bank row's owner whose number equals the row's reference: the
 * card account the ledger books a card debit against when the row has no stored link.
 */
const getLegacyReferenceAccountsByBankTransactionIds = sql<IGetLegacyReferenceAccountsByBankTransactionIdsQuery>`
  SELECT t.id AS bank_transaction_id,
    fa.id AS account_id
  FROM accounter_schema.transactions t
    JOIN accounter_schema.financial_accounts fa
      ON fa.owner_id = t.owner_id
      AND fa.account_number = t.source_reference
  WHERE t.id IN $$bankTransactionIds;`;

const insertCreditCardStatementLinks = sql<IInsertCreditCardStatementLinksQuery>`
  INSERT INTO accounter_schema.creditcard_statement_links (
    owner_id,
    bank_transaction_id,
    card_account_id,
    currency,
    debit_date,
    link_method
  )
  VALUES $$links(
    ownerId,
    bankTransactionId,
    cardAccountId,
    currency,
    debitDate,
    linkMethod
  )
  ON CONFLICT (card_account_id, currency, debit_date) DO NOTHING
  RETURNING *;`;

const deleteCreditCardStatementLink = sql<IDeleteCreditCardStatementLinkQuery>`
  DELETE FROM accounter_schema.creditcard_statement_links
  WHERE owner_id = $ownerId
    AND bank_transaction_id = $bankTransactionId
    AND card_account_id = $cardAccountId
    AND currency = $currency
    AND debit_date = $debitDate
  RETURNING *;`;

/** The card transactions that make up each statement. */
const getCardTransactionsByStatementKeys = sql<IGetCardTransactionsByStatementKeysQuery>`
  SELECT t.*,
    COALESCE(t.debit_date_override, t.debit_date) AS statement_debit_date
  FROM accounter_schema.transactions t
    JOIN accounter_schema.financial_accounts a
      ON a.id = t.account_id
      AND a.owner_id = t.owner_id
      AND a.type = 'CREDIT_CARD'
  WHERE t.account_id IN $$cardAccountIds
    AND (t.account_id::text || '|' || t.currency::text || '|' || COALESCE(t.debit_date_override, t.debit_date)::text) IN $$statementKeys
  ORDER BY t.event_date, t.id;`;

/**
 * Bank transactions of the owner that may be card debits and are not linked yet (fees aside):
 * - debits counted against a card issuer business;
 * - rows of a bank account configured as some card's settlement account;
 * - rows carrying a card clue: a raw bank hint (Poalim 491, Otsar Hahayal `origin_reference`), a
 *   reference equal to a card number, a card name in the description, or the last 4 digits of a
 *   card as a standalone group in the description.
 * Only rows with at least one card statement in the date window are returned, so rows that can
 * never match are not re-matched on every run. The matcher decides; rows without a strong clue
 * still need an exact, unique amount to be linked.
 */
const getAutoLinkCandidateBankTransactionIds = sql<IGetAutoLinkCandidateBankTransactionIdsQuery>`
  SELECT t.id
  FROM accounter_schema.transactions t
    JOIN accounter_schema.financial_accounts a
      ON a.id = t.account_id
      AND a.owner_id = t.owner_id
      AND a.type <> 'CREDIT_CARD'
    LEFT JOIN accounter_schema.transactions_raw_list rl
      ON rl.id = t.source_id
    LEFT JOIN accounter_schema.otsar_hahayal_ils_account_transactions o
      ON o.id = rl.otsar_hahayal_ils_id
    LEFT JOIN accounter_schema.poalim_ils_account_transactions p
      ON p.id = rl.poalim_ils_id
  WHERE t.owner_id = $ownerId
    AND t.is_fee IS FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM accounter_schema.creditcard_statement_links l
      WHERE l.bank_transaction_id = t.id
    )
    -- a card statement in the date window, in the row currency: otherwise nothing can match
    AND EXISTS (
      SELECT 1
      FROM accounter_schema.transactions ct
        JOIN accounter_schema.financial_accounts ca
          ON ca.id = ct.account_id
          AND ca.owner_id = ct.owner_id
          AND ca.type = 'CREDIT_CARD'
      WHERE ct.owner_id = t.owner_id
        AND ct.currency = t.currency
        AND COALESCE(ct.debit_date_override, ct.debit_date)
          BETWEEN COALESCE(t.debit_date_override, t.debit_date, t.event_date) - $windowDays::int
          AND COALESCE(t.debit_date_override, t.debit_date, t.event_date) + $windowDays::int
    )
    AND (
      t.business_id = ANY ($creditCardBusinessIds::uuid[])
      OR btrim(COALESCE(o.origin_reference, '')) <> ''
      OR p.activity_type_code = 491
      OR EXISTS (
        SELECT 1
        FROM accounter_schema.financial_credit_card_accounts cca
        WHERE cca.owner_id = t.owner_id
          AND cca.settlement_account_id = t.account_id
      )
      OR EXISTS (
        SELECT 1
        FROM accounter_schema.financial_accounts card
        WHERE card.owner_id = t.owner_id
          AND card.type = 'CREDIT_CARD'
          AND (
            card.account_number = t.source_reference
            OR (
              card.account_name IS NOT NULL
              AND card.account_name <> ''
              AND t.source_description LIKE '%' || card.account_name || '%'
            )
            OR (
              length(regexp_replace(card.account_number, '[^0-9]', '', 'g')) >= 4
              AND ' ' || regexp_replace(COALESCE(t.source_description, ''), '[^0-9]', ' ', 'g') || ' '
                LIKE '% ' || right(regexp_replace(card.account_number, '[^0-9]', '', 'g'), 4) || ' %'
            )
          )
      )
    )
  ORDER BY COALESCE(t.debit_date_override, t.debit_date, t.event_date), t.id;`;

const getRejectionsByBankTransactionIds = sql<IGetRejectionsByBankTransactionIdsQuery>`
  SELECT r.*
  FROM accounter_schema.creditcard_statement_link_rejections r
    JOIN accounter_schema.transactions t
      ON t.id = r.bank_transaction_id
      AND t.owner_id = r.owner_id
  WHERE r.bank_transaction_id IN $$bankTransactionIds;`;

const insertRejection = sql<IInsertRejectionQuery>`
  INSERT INTO accounter_schema.creditcard_statement_link_rejections (
    owner_id,
    bank_transaction_id,
    card_account_id,
    currency,
    debit_date
  )
  VALUES ($ownerId, $bankTransactionId, $cardAccountId, $currency, $debitDate)
  ON CONFLICT (bank_transaction_id, card_account_id, currency, debit_date) DO NOTHING
  RETURNING *;`;

const deleteRejections = sql<IDeleteRejectionsQuery>`
  DELETE FROM accounter_schema.creditcard_statement_link_rejections
  WHERE owner_id = $ownerId
    AND bank_transaction_id = $bankTransactionId
    AND (card_account_id::text || '|' || currency::text || '|' || debit_date::text) IN $$statementKeys
  RETURNING id;`;

export type BankTransactionRow = IGetBankTransactionsByIdsResult;
export type CandidateStatementRow = IGetCandidateStatementsByBankTransactionIdsResult;
export type CreditCardStatementLinkRow = IGetCreditCardStatementLinksByBankTransactionIdsResult;
export type CardTransactionRow = IGetCardTransactionsByStatementKeysResult;
export type CreditCardStatementLinkMethod = creditcard_statement_link_method;

export type NewCreditCardStatementLink = StatementKey & {
  ownerId: string;
  bankTransactionId: string;
  linkMethod: CreditCardStatementLinkMethod;
};

function statementKeysParams(keys: readonly StatementKey[]) {
  return {
    cardAccountIds: Array.from(new Set(keys.map(key => key.cardAccountId))),
    statementKeys: Array.from(new Set(keys.map(statementKeyId))),
  };
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CreditCardStatementsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  /**
   * Whether the bank row's counterparty is one of its owner's card issuer businesses (the admin
   * context's `creditCardIds`). Read per owner, since a request's read scope can span businesses.
   */
  public async isCounterpartyCardIssuer(
    row: Pick<BankTransactionRow, 'owner_id' | 'business_id'>,
  ): Promise<boolean> {
    if (!row.business_id) {
      return false;
    }
    const context = await this.adminContextProvider.adminContextByOwnerIdLoader.load(row.owner_id);
    return !!context?.financialAccounts.creditCardIds.includes(row.business_id);
  }

  private async batchRejectionsByBankTransactionIds(bankTransactionIds: readonly string[]) {
    const rows = await getRejectionsByBankTransactionIds.run({ bankTransactionIds }, this.db);
    return bankTransactionIds.map(id =>
      rows
        .filter(row => row.bank_transaction_id === id)
        .map(row => ({
          cardAccountId: row.card_account_id,
          currency: row.currency as string,
          debitDate: row.debit_date,
        })),
    );
  }

  /** Statements a user unlinked from each bank transaction */
  public getRejectedStatementsByBankTransactionIdLoader = new DataLoader(
    (bankTransactionIds: readonly string[]) =>
      this.batchRejectionsByBankTransactionIds(bankTransactionIds),
  );

  /** Remembers that a user unlinked this statement from this bank transaction */
  public async rejectStatement(
    params: StatementKey & { ownerId: string; bankTransactionId: string },
  ) {
    await insertRejection.run(
      {
        ownerId: params.ownerId,
        bankTransactionId: params.bankTransactionId,
        cardAccountId: params.cardAccountId,
        currency: params.currency as currency,
        debitDate: params.debitDate,
      },
      this.db,
    );
    this.getRejectedStatementsByBankTransactionIdLoader.clear(params.bankTransactionId);
  }

  /** Forgets earlier rejections, when a user links the statements again */
  public async clearRejections(params: {
    ownerId: string;
    bankTransactionId: string;
    statements: readonly StatementKey[];
  }) {
    if (params.statements.length === 0) {
      return;
    }
    await deleteRejections.run(
      {
        ownerId: params.ownerId,
        bankTransactionId: params.bankTransactionId,
        statementKeys: Array.from(new Set(params.statements.map(statementKeyId))),
      },
      this.db,
    );
    this.getRejectedStatementsByBankTransactionIdLoader.clear(params.bankTransactionId);
  }

  private async batchBankTransactionsByChargeIds(chargeIds: readonly string[]) {
    const rows = await getBankTransactionsByChargeIds.run({ chargeIds }, this.db);
    return chargeIds.map(id => rows.filter(row => row.charge_id === id));
  }

  /** Non-card transactions of each charge */
  public getBankTransactionsByChargeIdLoader = new DataLoader((chargeIds: readonly string[]) =>
    this.batchBankTransactionsByChargeIds(chargeIds),
  );

  private async batchBankTransactionsByIds(transactionIds: readonly string[]) {
    const rows = await getBankTransactionsByIds.run({ transactionIds }, this.db);
    return transactionIds.map(id => rows.find(row => row.id === id));
  }

  /** Any transaction by id, with its account type and effective date */
  public getBankTransactionByIdLoader = new DataLoader((transactionIds: readonly string[]) =>
    this.batchBankTransactionsByIds(transactionIds),
  );

  private async batchBankCardHintsByTransactionIds(transactionIds: readonly string[]) {
    const rows = await getBankCardHintsByTransactionIds.run({ transactionIds }, this.db);
    return transactionIds.map(id =>
      rows
        .filter(row => row.transaction_id === id && row.hint)
        .map(row => ({ transactionId: id, source: row.source ?? '', hint: row.hint ?? '' })),
    );
  }

  /** Card clues from the banks' raw rows, per bank transaction */
  public getBankCardHintsByTransactionIdLoader = new DataLoader(
    (transactionIds: readonly string[]) => this.batchBankCardHintsByTransactionIds(transactionIds),
  );

  private async batchCandidateStatementsByBankTransactionIds(
    bankTransactionIds: readonly string[],
  ) {
    const rows = await getCandidateStatementsByBankTransactionIds.run(
      { bankTransactionIds, windowDays: STATEMENT_DATE_WINDOW_DAYS },
      this.db,
    );
    return bankTransactionIds.map(id => rows.filter(row => row.bank_transaction_id === id));
  }

  /** Card statements within the date window of each bank transaction */
  public getCandidateStatementsByBankTransactionIdLoader = new DataLoader(
    (bankTransactionIds: readonly string[]) =>
      this.batchCandidateStatementsByBankTransactionIds(bankTransactionIds),
  );

  private async batchLinksByBankTransactionIds(bankTransactionIds: readonly string[]) {
    const rows = await getCreditCardStatementLinksByBankTransactionIds.run(
      { bankTransactionIds },
      this.db,
    );
    return bankTransactionIds.map(id => rows.filter(row => row.bank_transaction_id === id));
  }

  /** Persisted statement links of each bank transaction */
  public getLinksByBankTransactionIdLoader = new DataLoader(
    (bankTransactionIds: readonly string[]) =>
      this.batchLinksByBankTransactionIds(bankTransactionIds),
  );

  private async batchHasLinksByChargeIds(chargeIds: readonly string[]) {
    const rows = await getLinkedChargeIds.run({ chargeIds }, this.db);
    const linked = new Set(rows.map(row => row.charge_id));
    return chargeIds.map(id => linked.has(id));
  }

  /** Whether a bank transaction of the charge has a stored statement link */
  public hasLinksByChargeIdLoader = new DataLoader((chargeIds: readonly string[]) =>
    this.batchHasLinksByChargeIds(chargeIds),
  );

  private async batchLegacyReferenceAccountIdsByBankTransactionIds(
    bankTransactionIds: readonly string[],
  ) {
    const rows = await getLegacyReferenceAccountsByBankTransactionIds.run(
      { bankTransactionIds },
      this.db,
    );
    return bankTransactionIds.map(id =>
      rows.filter(row => row.bank_transaction_id === id).map(row => row.account_id),
    );
  }

  /**
   * Per bank transaction, the owner's financial accounts numbered as its reference: what the ledger
   * resolved a card debit to before links existed.
   */
  public getLegacyReferenceAccountIdsByBankTransactionIdLoader = new DataLoader(
    (bankTransactionIds: readonly string[]) =>
      this.batchLegacyReferenceAccountIdsByBankTransactionIds(bankTransactionIds),
  );

  private async batchCardTransactionsByStatementKeys(keyIds: readonly string[]) {
    const keys = keyIds.map(parseStatementKeyId);
    const rows = await getCardTransactionsByStatementKeys.run(statementKeysParams(keys), this.db);
    return keyIds.map(keyId =>
      rows.filter(
        row =>
          row.statement_debit_date &&
          statementKeyId({
            cardAccountId: row.account_id,
            currency: row.currency,
            debitDate: row.statement_debit_date,
          }) === keyId,
      ),
    );
  }

  /** The card transactions of each statement, keyed by `statementKeyId()` */
  public getCardTransactionsByStatementKeyLoader = new DataLoader((keyIds: readonly string[]) =>
    this.batchCardTransactionsByStatementKeys(keyIds),
  );

  public async getLinksByStatementKeys(ownerId: string, keys: readonly StatementKey[]) {
    if (keys.length === 0) {
      return [];
    }
    return getCreditCardStatementLinksByStatementKeys.run(
      { ownerId, ...statementKeysParams(keys) },
      this.db,
    );
  }

  public async getAutoLinkCandidateBankTransactionIds(params: {
    ownerId: string;
    creditCardBusinessIds: readonly string[];
  }) {
    const rows = await getAutoLinkCandidateBankTransactionIds.run(
      {
        ownerId: params.ownerId,
        creditCardBusinessIds: [...params.creditCardBusinessIds],
        windowDays: STATEMENT_DATE_WINDOW_DAYS,
      },
      this.db,
    );
    return rows.map(row => row.id);
  }

  /** Inserts links, skipping statements that are already linked. Returns the inserted rows. */
  public async insertLinksIfFree(links: readonly NewCreditCardStatementLink[]) {
    if (links.length === 0) {
      return [];
    }
    const inserted = await insertCreditCardStatementLinks.run(
      {
        links: links.map(link => ({
          ownerId: link.ownerId,
          bankTransactionId: link.bankTransactionId,
          cardAccountId: link.cardAccountId,
          currency: link.currency as currency,
          debitDate: link.debitDate,
          linkMethod: link.linkMethod,
        })),
      },
      this.db,
    );
    this.clearCache();
    return inserted;
  }

  /**
   * Inserts links, all or nothing: a statement can be settled by one bank transaction only, so a
   * statement that is already linked fails the whole call with a readable error.
   */
  public async insertLinks(links: readonly NewCreditCardStatementLink[]) {
    if (links.length === 0) {
      return [];
    }
    return this.db.transaction(async () => {
      const inserted = await this.insertLinksIfFree(links);
      if (inserted.length !== links.length) {
        const insertedKeys = new Set(
          inserted.map(row =>
            statementKeyId({
              cardAccountId: row.card_account_id,
              currency: row.currency,
              debitDate: row.debit_date,
            }),
          ),
        );
        const taken = links.filter(link => !insertedKeys.has(statementKeyId(link)));
        throw new GraphQLError(
          `Credit card statement already linked to another bank transaction: ${taken
            .map(link => `${link.currency} ${link.debitDate}`)
            .join(', ')}`,
        );
      }
      return inserted;
    });
  }

  public async deleteLink(params: StatementKey & { ownerId: string; bankTransactionId: string }) {
    const deleted = await deleteCreditCardStatementLink.run(
      {
        ownerId: params.ownerId,
        bankTransactionId: params.bankTransactionId,
        cardAccountId: params.cardAccountId,
        currency: params.currency as currency,
        debitDate: params.debitDate,
      },
      this.db,
    );
    this.clearCache();
    return deleted;
  }

  /**
   * A user's link: inserts the MANUAL links and forgets earlier rejections of the `relinked`
   * statements for this bank transaction, in one transaction.
   */
  public async linkStatementsManually(params: {
    ownerId: string;
    bankTransactionId: string;
    statements: readonly StatementKey[];
    relinked: readonly StatementKey[];
  }) {
    return this.db.transaction(async () => {
      const inserted = await this.insertLinks(
        params.statements.map(statement => ({
          cardAccountId: statement.cardAccountId,
          currency: statement.currency,
          debitDate: statement.debitDate,
          ownerId: params.ownerId,
          bankTransactionId: params.bankTransactionId,
          linkMethod: 'MANUAL' as const,
        })),
      );
      await this.clearRejections({
        ownerId: params.ownerId,
        bankTransactionId: params.bankTransactionId,
        statements: params.relinked,
      });
      return inserted;
    });
  }

  /** A user's dismissal of a computed match: records the rejections, in one transaction */
  public async rejectStatements(params: {
    ownerId: string;
    bankTransactionId: string;
    statements: readonly StatementKey[];
  }) {
    await this.db.transaction(async () => {
      for (const statement of params.statements) {
        await this.rejectStatement({
          ...statement,
          ownerId: params.ownerId,
          bankTransactionId: params.bankTransactionId,
        });
      }
    });
    this.clearCache();
  }

  /**
   * A user's unlink: deletes the link and records the rejection, in one transaction. Returns the
   * deleted link (empty when the statement was not linked to this bank transaction).
   */
  public async unlinkStatement(
    params: StatementKey & { ownerId: string; bankTransactionId: string },
  ) {
    return this.db.transaction(async () => {
      const deleted = await this.deleteLink(params);
      if (deleted.length > 0) {
        await this.rejectStatement(params);
      }
      return deleted;
    });
  }

  public clearCache() {
    this.getCandidateStatementsByBankTransactionIdLoader.clearAll();
    this.getLinksByBankTransactionIdLoader.clearAll();
    this.getRejectedStatementsByBankTransactionIdLoader.clearAll();
    this.hasLinksByChargeIdLoader.clearAll();
  }
}

export function parseStatementKeyId(keyId: string): StatementKey {
  const [cardAccountId, currencyCode, debitDate] = keyId.split('|');
  return {
    cardAccountId,
    currency: currencyCode,
    debitDate: debitDate as StatementKey['debitDate'],
  };
}
