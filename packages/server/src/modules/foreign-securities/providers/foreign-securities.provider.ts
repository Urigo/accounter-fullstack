import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { SecurityTradeType } from '../../../shared/enums.js';
import {
  addDaysToTimelessDate,
  compareTimelessDates,
  maxTimelessDate,
  minTimelessDate,
} from '../../../shared/helpers/timeless-date.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from '../../financial-accounts/providers/financial-bank-accounts.provider.js';
import type { IGetFinancialAccountsByOwnerIdsResult } from '../../financial-accounts/types.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import {
  CASH_SETTLEMENT_WINDOW_DAYS,
  matchExecutionsToTransactions,
  matchSecurityExecutions,
  transactionCashDates,
  type AccountTuple,
  type MatchableTransaction,
} from '../helpers/match-security-executions.helper.js';
import {
  securityAccountId,
  type SecurityAccountProto,
} from '../helpers/security-account.helper.js';
import { pairSecurityTransfers } from '../helpers/security-cost-basis.helper.js';
import { tryToSecurityTradeType } from '../helpers/security-execution-enums.helper.js';
import { extractTransactionSecurityKeys } from '../helpers/security-key.helper.js';
import type {
  ChargeSecurityProto,
  IGetFilteredSecurityExecutionsQuery,
  IGetSecuritiesByKeysQuery,
  IGetSecurityExecutionsByBusinessIdsQuery,
  IGetSecurityExecutionsByChargeIdsQuery,
  IGetSecurityExecutionsQuery,
  PaginatedSecurityExecutionsProto,
  SecurityExecutionRow,
  SecurityExecutionsFilterInput,
  SecurityHistoryExecutionProto,
  SecurityRow,
} from '../types.js';
import { SecurityBusinessesProvider } from './security-businesses.provider.js';

/** The executions that move units between accounts rather than buying or selling them */
const TRANSFER_TRADE_TYPES = new Set<SecurityTradeType>([
  SecurityTradeType.TransferIn,
  SecurityTradeType.TransferOut,
  SecurityTradeType.TransferInTwoSided,
  SecurityTradeType.TransferOutTwoSided,
]);

/**
 * Deduped per owner as well as per key, and returning the owner.
 *
 * RLS scopes this to the request's business *scope*, which can span several businesses, and the
 * bank's key is only unique within one of them — two businesses trading the same security each
 * have a reference row for it. Deduping on the key alone would hand one business the other's
 * reference details. The dedup key also includes branch/account in the table itself, so one owner
 * can hold the same security in several accounts — `DISTINCT ON` keeps the freshest scrape.
 */
const getSecuritiesByKeys = sql<IGetSecuritiesByKeysQuery>`
  SELECT DISTINCT ON (owner_id, security_key)
         id, owner_id, security_key, eng_name, heb_name, symbol, eng_symbol, heb_symbol,
         item_type, stock_type, exchange, currency_code, is_etf, is_foreign, as_of_date
  FROM accounter_schema.poalim_securities
  WHERE owner_id = $ownerId!
    AND security_key = ANY($securityKeys!)
  ORDER BY owner_id, security_key, as_of_date DESC;`;

/**
 * A prefilter, not the match itself: the ANY(...) predicates form a cross-product over the
 * charge's keys and accounts, and the date range spans every day the charge's cash could belong
 * to an execution. `matchSecurityExecutions` does the per-row pairing in memory, where the
 * account tuple, key, amount, direction and dates are checked together.
 *
 * Tenant scoping is RLS again (FORCE ROW LEVEL SECURITY + tenant_isolation), hence no
 * owner_id predicate.
 */
const getSecurityExecutions = sql<IGetSecurityExecutionsQuery>`
  SELECT
    id,
    owner_id,
    security,
    bank_number,
    branch_number,
    account_number,
    trade_date,
    value_date,
    settlement_date,
    payment_date,
    trade_type,
    transaction_type,
    nv,
    trade_price,
    trade_gross_value_trade_currency,
    net_value_trade_currency,
    net_value_settlement_currency,
    net_value_nis,
    trade_currency,
    settlement_currency,
    trade_commission_value_trade_currency,
    trade_commission_value_nis,
    commissions_currency,
    management_fees_value_trade_currency,
    israe_tax_value,
    nominal_profit_loss_nis,
    nominal_profit_loss_linkage,
    real_profit_loss_nis,
    payment_type,
    symbol,
    isin,
    issuer_country_code,
    foreign_tax_value_settlement_currency,
    israel_tax_value_by_payments_settlement_currency,
    capital_tax_value_settlement_currency,
    is_cancel_transaction,
    trade_gross_value_nis,
    personal_currency_rate
  FROM accounter_schema.poalim_securities_transactions
  WHERE security = ANY($securities!)
    AND bank_number = ANY($bankNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND account_number = ANY($accountNumbers!)
    AND COALESCE(value_date, trade_date) >= $fromDate!
    AND trade_date <= $toDate!;`;

/**
 * Every ingested execution of the given security businesses, unbounded by charge or date — the
 * whole life of an instrument, which is what its page shows.
 *
 * Addressed by security *business* rather than by Poalim key, through a join on the identifier
 * bridge. A key is only unique within an owner — `security_identifiers` is unique on
 * `(owner_id, identifier_type, identifier_value)`, and the same security traded by two of a
 * tenant's businesses carries the same key under each. Reads follow the request's whole business
 * scope rather than one business, so filtering on the key alone would pull one business's
 * executions into another's history and position. The join carries the owner on both sides and
 * hands back the business each row belongs to, resolving the relation once, in SQL, rather than
 * rebuilding it from a map that cannot express it.
 *
 * Tenant scoping is still RLS, on both tables.
 */
const getSecurityExecutionsByBusinessIds = sql<IGetSecurityExecutionsByBusinessIdsQuery>`
  SELECT
    t.id,
    t.owner_id,
    t.security,
    t.bank_number,
    t.branch_number,
    t.account_number,
    t.trade_date,
    t.value_date,
    t.settlement_date,
    t.payment_date,
    t.trade_type,
    t.transaction_type,
    t.nv,
    t.trade_price,
    t.trade_gross_value_trade_currency,
    t.net_value_trade_currency,
    t.net_value_settlement_currency,
    t.net_value_nis,
    t.trade_currency,
    t.settlement_currency,
    t.trade_commission_value_trade_currency,
    t.trade_commission_value_nis,
    t.commissions_currency,
    t.management_fees_value_trade_currency,
    t.israe_tax_value,
    t.nominal_profit_loss_nis,
    t.nominal_profit_loss_linkage,
    t.real_profit_loss_nis,
    t.payment_type,
    t.symbol,
    t.isin,
    t.issuer_country_code,
    t.foreign_tax_value_settlement_currency,
    t.israel_tax_value_by_payments_settlement_currency,
    t.capital_tax_value_settlement_currency,
    t.is_cancel_transaction,
    t.trade_gross_value_nis,
    t.personal_currency_rate,
    si.business_id AS security_business_id
  FROM accounter_schema.poalim_securities_transactions t
  INNER JOIN accounter_schema.security_identifiers si
    ON si.owner_id = t.owner_id
    AND si.identifier_type = 'POALIM_SECURITY_KEY'
    AND si.identifier_value = t.security
  WHERE si.business_id IN $$businessIds
  ORDER BY t.trade_date, t.id;`;

/**
 * The paginated, filtered slice `Query.securityExecutions` serves.
 *
 * Newest first, deliberately the opposite of `getSecurityExecutionsByBusinessIds`: that one
 * feeds `calculateSecurityPosition`, which reads a position's currency off the *first* execution
 * and so depends on chronological order. This one is read by a human asking what happened lately.
 *
 * Addressed by security business through the same identifier join, for the same reason — see the
 * note there. Resolving the relation in SQL rather than after the fact also keeps
 * `COUNT(*) OVER ()` honest: a row dropped in memory for belonging to another owner would leave a
 * total that no longer matches what pagination can reach.
 *
 * Trade and transaction types are filtered on the bank's own labels — the caller passes GraphQL
 * enums and the resolver translates them through `tradeTypeToRaw` / `transactionTypeToRaw`, so
 * the Hebrew never appears outside the enum helper.
 *
 * `COUNT(*) OVER ()` rides on the returned rows, which means a request for a page past the end
 * reports a total of 0 rather than the real count. That is the only inaccuracy, it costs a
 * second round trip to fix, and it only misreports a page the caller invented — so it stands.
 *
 * Tenant scoping is RLS, as everywhere in this file.
 */
const getFilteredSecurityExecutions = sql<IGetFilteredSecurityExecutionsQuery>`
  SELECT
    t.id,
    t.owner_id,
    t.security,
    t.bank_number,
    t.branch_number,
    t.account_number,
    t.trade_date,
    t.value_date,
    t.settlement_date,
    t.payment_date,
    t.trade_type,
    t.transaction_type,
    t.nv,
    t.trade_price,
    t.trade_gross_value_trade_currency,
    t.net_value_trade_currency,
    t.net_value_settlement_currency,
    t.net_value_nis,
    t.trade_currency,
    t.settlement_currency,
    t.trade_commission_value_trade_currency,
    t.trade_commission_value_nis,
    t.commissions_currency,
    t.management_fees_value_trade_currency,
    t.israe_tax_value,
    t.nominal_profit_loss_nis,
    t.nominal_profit_loss_linkage,
    t.real_profit_loss_nis,
    t.payment_type,
    t.symbol,
    t.isin,
    t.issuer_country_code,
    t.foreign_tax_value_settlement_currency,
    t.israel_tax_value_by_payments_settlement_currency,
    t.capital_tax_value_settlement_currency,
    t.is_cancel_transaction,
    t.trade_gross_value_nis,
    t.personal_currency_rate,
    si.business_id AS security_business_id,
    COUNT(*) OVER () AS total_count
  FROM accounter_schema.poalim_securities_transactions t
  INNER JOIN accounter_schema.security_identifiers si
    ON si.owner_id = t.owner_id
    AND si.identifier_type = 'POALIM_SECURITY_KEY'
    AND si.identifier_value = t.security
  WHERE si.business_id IN $$businessIds
    AND ($isTradeTypes = 0 OR t.trade_type IN $$tradeTypes)
    AND ($isTransactionTypes = 0 OR t.transaction_type IN $$transactionTypes)
    AND ($fromTradeDate::DATE IS NULL OR t.trade_date >= $fromTradeDate)
    AND ($toTradeDate::DATE IS NULL OR t.trade_date <= $toTradeDate)
  ORDER BY t.trade_date DESC, t.id DESC
  LIMIT $limit! OFFSET $offset!;`;

/**
 * The executions a charge books directly, through `charges_securities_executions` — those with no
 * cash leg to pair with (stock distributions). Same column list as `getSecurityExecutions`, so the
 * rows are `SecurityExecutionRow`s, plus the charge each belongs to.
 *
 * Tenant scoping is RLS, on both tables.
 */
const getSecurityExecutionsByChargeIds = sql<IGetSecurityExecutionsByChargeIdsQuery>`
  SELECT
    t.id,
    t.owner_id,
    t.security,
    t.bank_number,
    t.branch_number,
    t.account_number,
    t.trade_date,
    t.value_date,
    t.settlement_date,
    t.payment_date,
    t.trade_type,
    t.transaction_type,
    t.nv,
    t.trade_price,
    t.trade_gross_value_trade_currency,
    t.net_value_trade_currency,
    t.net_value_settlement_currency,
    t.net_value_nis,
    t.trade_currency,
    t.settlement_currency,
    t.trade_commission_value_trade_currency,
    t.trade_commission_value_nis,
    t.commissions_currency,
    t.management_fees_value_trade_currency,
    t.israe_tax_value,
    t.nominal_profit_loss_nis,
    t.nominal_profit_loss_linkage,
    t.real_profit_loss_nis,
    t.payment_type,
    t.symbol,
    t.isin,
    t.issuer_country_code,
    t.foreign_tax_value_settlement_currency,
    t.israel_tax_value_by_payments_settlement_currency,
    t.capital_tax_value_settlement_currency,
    t.is_cancel_transaction,
    t.trade_gross_value_nis,
    t.personal_currency_rate,
    l.charge_id
  FROM accounter_schema.charges_securities_executions l
  INNER JOIN accounter_schema.poalim_securities_transactions t
    ON t.id = l.execution_id
  WHERE l.charge_id = ANY($chargeIds!)
  ORDER BY t.trade_date, t.id;`;

/**
 * How many securities `includeCharges` will pair at once.
 *
 * Each one costs its whole execution history plus a transactions query, because the pairing is
 * only correct over a complete set (see `matchExecutionsToTransactions`). The cap is what keeps
 * "every trade I ever made, with charges" from turning into a portfolio-wide fan-out.
 */
export const MAX_CHARGE_LINK_SECURITIES = 10;

/** What the reverse match needs off a transaction, charge included so a row can link out. */
type MatchedTransaction = MatchableTransaction & {
  charge_id: string;
  /** The exact time of the cash leg, when known; what the ledger prices it at before its day */
  debit_timestamp: Date | null;
};

/**
 * A Poalim security key, qualified by the owner it belongs to.
 *
 * The bank's key is only unique within an owner, and reads follow the request's whole business
 * scope rather than a single business — so the key alone cannot identify a security once a tenant
 * has two businesses trading the same one.
 */
export type OwnedSecurityKey = { ownerId: string; securityKey: string };

function ownedKey(ownerId: string, securityKey: string): string {
  return `${ownerId}:${securityKey}`;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ForeignSecuritiesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private transactionsProvider: TransactionsProvider,
    private financialAccountsProvider: FinancialAccountsProvider,
    private financialBankAccountsProvider: FinancialBankAccountsProvider,
    private securityBusinessesProvider: SecurityBusinessesProvider,
  ) {}

  private async batchSecuritiesByKeys(keys: readonly OwnedSecurityKey[]) {
    // One query per owner; in practice a batch carries a single one, since a charge belongs to
    // exactly one business.
    const keysByOwner = new Map<string, Set<string>>();
    for (const key of keys) {
      const values = keysByOwner.get(key.ownerId);
      if (values) {
        values.add(key.securityKey);
      } else {
        keysByOwner.set(key.ownerId, new Set([key.securityKey]));
      }
    }

    const securityByOwnedKey = new Map<string, SecurityRow>();
    await Promise.all(
      [...keysByOwner].map(async ([ownerId, securityKeys]) => {
        const securities = await getSecuritiesByKeys.run(
          { ownerId, securityKeys: [...securityKeys] },
          this.db,
        );
        // DISTINCT ON guarantees one row per (owner, key), so a plain Map is enough.
        for (const security of securities) {
          securityByOwnedKey.set(ownedKey(security.owner_id, security.security_key), security);
        }
      }),
    );

    return keys.map(key => securityByOwnedKey.get(ownedKey(key.ownerId, key.securityKey)) ?? null);
  }

  public securityByKeyLoader = new DataLoader(
    (keys: readonly OwnedSecurityKey[]) => this.batchSecuritiesByKeys(keys),
    { cacheKeyFn: key => ownedKey(key.ownerId, key.securityKey) },
  );

  /**
   * The Poalim identity (bank/branch/account) of each account the given transactions touch.
   * `financial_accounts.account_number` is text while the poalim_* tables store it as an
   * integer, so non-numeric account numbers (and non-bank accounts, which have no
   * financial_bank_accounts row) simply drop out — they can never match an execution.
   */
  private async getAccountTuples(
    accountIds: readonly string[],
  ): Promise<Map<string, AccountTuple>> {
    const tuples = new Map<string, AccountTuple>();

    await Promise.all(
      accountIds.map(async accountId => {
        const [account, bankAccount] = await Promise.all([
          this.financialAccountsProvider.getFinancialAccountByAccountIDLoader.load(accountId),
          this.financialBankAccountsProvider.getFinancialBankAccountByIdLoader.load(accountId),
        ]);
        if (!account || !bankAccount) {
          return;
        }

        const accountNumber = Number(account.account_number);
        if (!Number.isInteger(accountNumber)) {
          return;
        }

        tuples.set(accountId, {
          bankNumber: bankAccount.bank_number,
          branchNumber: bankAccount.branch_number,
          accountNumber,
        });
      }),
    );

    return tuples;
  }

  /** Memo for {@link getFinancialAccountBySecurityAccount}, by owner; the provider lives for one operation. */
  private financialAccountsBySecurityAccountCache = new Map<
    string,
    Promise<Map<string, IGetFinancialAccountsByOwnerIdsResult>>
  >();

  /**
   * The owner's financial account a portfolio account is: the bank account with the same bank,
   * branch and account numbers. Null when the owner has none registered — the executions name the
   * account by those numbers only.
   *
   * The inverse of {@link getAccountTuples}, over the owner's accounts. Should two of them carry the
   * same numbers, the bank account wins, since that is what the bank scrapes a portfolio under.
   */
  public async getFinancialAccountBySecurityAccount(
    account: SecurityAccountProto,
  ): Promise<IGetFinancialAccountsByOwnerIdsResult | null> {
    let cached = this.financialAccountsBySecurityAccountCache.get(account.ownerId);
    if (!cached) {
      cached = this.financialAccountsProvider.getFinancialAccountsByOwnerIdLoader
        .load(account.ownerId)
        .then(async financialAccounts => {
          const tuples = await this.getAccountTuples(financialAccounts.map(({ id }) => id));
          const byAccountId = new Map<string, IGetFinancialAccountsByOwnerIdsResult>();
          for (const financialAccount of financialAccounts) {
            const tuple = tuples.get(financialAccount.id);
            if (!tuple) {
              continue;
            }
            const accountId = securityAccountId(tuple);
            if (!byAccountId.has(accountId) || financialAccount.type === 'BANK_ACCOUNT') {
              byAccountId.set(accountId, financialAccount);
            }
          }
          return byAccountId;
        });
      this.financialAccountsBySecurityAccountCache.set(account.ownerId, cached);
    }
    return (await cached).get(securityAccountId(account)) ?? null;
  }

  /**
   * The executions that could pair with the given transactions, plus the Poalim identity of each
   * account they touch. Null when the transactions touch no resolvable Poalim account or carry no
   * date, so a charge whose accounts predate the bank-account backfill degrades to "no activity"
   * rather than erroring.
   */
  private async getCandidateExecutions(
    transactions: readonly MatchableTransaction[],
    securityKeys: readonly string[],
  ): Promise<{
    candidates: SecurityExecutionRow[];
    accountTuples: Map<string, AccountTuple>;
  } | null> {
    const accountTuples = await this.getAccountTuples([
      ...new Set(transactions.map(transaction => transaction.account_id)),
    ]);
    if (accountTuples.size === 0) {
      return null;
    }

    // An execution's value date is at most the settlement window before the day its cash moves,
    // and its trade is never after it — so those bound the days worth fetching. A transaction with
    // no date at all can never pair up.
    const cashDates = transactions.flatMap(transaction => transactionCashDates(transaction));
    const earliestCashDate = minTimelessDate(...cashDates);
    const latestCashDate = maxTimelessDate(...cashDates);
    if (!earliestCashDate || !latestCashDate) {
      return null;
    }

    const tuples = [...accountTuples.values()];
    const candidates = await getSecurityExecutions.run(
      {
        securities: [...securityKeys],
        bankNumbers: [...new Set(tuples.map(tuple => tuple.bankNumber))],
        branchNumbers: [...new Set(tuples.map(tuple => tuple.branchNumber))],
        accountNumbers: [...new Set(tuples.map(tuple => tuple.accountNumber))],
        fromDate: addDaysToTimelessDate(earliestCashDate, -CASH_SETTLEMENT_WINDOW_DAYS),
        toDate: latestCashDate,
      },
      this.db,
    );

    return { candidates, accountTuples };
  }

  /**
   * Ingested portfolio executions matched to the charge's main transactions, grouped by security
   * key. Empty when the charge touches no resolvable Poalim account — see
   * {@link getCandidateExecutions}.
   *
   * Fees are left out of the pairing, as in {@link getChargeExecutionsByTransactionId}: a fee is
   * never the cash leg of an execution. The executions fetched are those of the securities the
   * main transactions name, so this and the ledger's pairing see the same candidates.
   */
  private async getMatchedExecutions(
    transactions: readonly (MatchableTransaction & { is_fee: boolean | null })[],
  ): Promise<Map<string, SecurityExecutionRow[]>> {
    const mainTransactions = transactions.filter(transaction => !transaction.is_fee);
    const securityKeys = [
      ...new Set(
        mainTransactions.flatMap(transaction => extractTransactionSecurityKeys(transaction)),
      ),
    ];
    if (securityKeys.length === 0) {
      return new Map();
    }
    const candidateExecutions = await this.getCandidateExecutions(mainTransactions, securityKeys);
    if (!candidateExecutions) {
      return new Map();
    }

    return matchSecurityExecutions(
      mainTransactions,
      candidateExecutions.candidates,
      candidateExecutions.accountTuples,
    );
  }

  private async batchExecutionsByChargeIds(
    chargeIds: readonly string[],
  ): Promise<SecurityExecutionRow[][]> {
    const rows = await getSecurityExecutionsByChargeIds.run(
      { chargeIds: [...new Set(chargeIds)] },
      this.db,
    );
    const byChargeId = new Map<string, SecurityExecutionRow[]>();
    for (const { charge_id, ...execution } of rows) {
      if (!charge_id) {
        continue;
      }
      const executions = byChargeId.get(charge_id);
      if (executions) {
        executions.push(execution);
      } else {
        byChargeId.set(charge_id, [execution]);
      }
    }
    return chargeIds.map(chargeId => byChargeId.get(chargeId) ?? []);
  }

  /**
   * The executions each charge books directly (see `charges_securities_executions`), oldest
   * first. Executions paired with a charge's cash transactions are not among them — those are
   * reached through the transactions, as everywhere else in this provider.
   */
  public executionsByChargeIdLoader = new DataLoader((chargeIds: readonly string[]) =>
    this.batchExecutionsByChargeIds(chargeIds),
  );

  /** Memo for {@link getChargeExecutionsByTransactionId}; the provider lives for one operation. */
  private chargeExecutionsCache = new Map<string, Promise<Map<string, SecurityExecutionRow>>>();

  /**
   * The execution behind each of a charge's main (non-fee) transactions, keyed by transaction id —
   * what the ledger needs to tell a dividend from a redemption. A transaction without an entry has
   * no matching ingested execution.
   *
   * Fees are left out of the pairing: it is greedy and one-to-one, and a fee is never the cash leg
   * of an execution, so letting one compete could only take a match away from the real one.
   * Executions of other owners in the request's business scope are left out too — the bank's key
   * is only unique within one owner.
   */
  public getChargeExecutionsByTransactionId(
    chargeId: string,
    ownerId: string,
  ): Promise<Map<string, SecurityExecutionRow>> {
    const cacheKey = ownedKey(ownerId, chargeId);
    let cached = this.chargeExecutionsCache.get(cacheKey);
    if (!cached) {
      cached = this.loadChargeExecutionsByTransactionId(chargeId, ownerId);
      this.chargeExecutionsCache.set(cacheKey, cached);
    }
    return cached;
  }

  private async loadChargeExecutionsByTransactionId(
    chargeId: string,
    ownerId: string,
  ): Promise<Map<string, SecurityExecutionRow>> {
    const transactions = (
      await this.transactionsProvider.transactionsByChargeIDLoader.load(chargeId)
    ).filter(transaction => !transaction.is_fee);

    const securityKeys = [
      ...new Set(transactions.flatMap(transaction => extractTransactionSecurityKeys(transaction))),
    ];
    if (securityKeys.length === 0) {
      return new Map();
    }

    const candidateExecutions = await this.getCandidateExecutions(transactions, securityKeys);
    if (!candidateExecutions) {
      return new Map();
    }

    const transactionByExecutionId = matchExecutionsToTransactions(
      transactions,
      candidateExecutions.candidates.filter(execution => execution.owner_id === ownerId),
      candidateExecutions.accountTuples,
    );

    const executionsById = new Map(
      candidateExecutions.candidates.map(execution => [execution.id, execution]),
    );
    const executionByTransactionId = new Map<string, SecurityExecutionRow>();
    for (const [executionId, transaction] of transactionByExecutionId) {
      const execution = executionsById.get(executionId);
      if (execution) {
        executionByTransactionId.set(transaction.id, execution);
      }
    }
    return executionByTransactionId;
  }

  /**
   * Every ingested execution of an execution's security in the same portfolio account, oldest
   * first — what a stock distribution's cancellation is looked for in.
   *
   * Addressed through the security business, so every Poalim key the ISIN is known by counts, and
   * narrowed to the execution's own bank/branch/account. Empty when the key belongs to no security
   * business. FIFO reads {@link getSecurityOwnerHistory} instead.
   */
  public async getSecurityAccountHistory(
    execution: Pick<
      SecurityExecutionRow,
      'security' | 'bank_number' | 'branch_number' | 'account_number'
    >,
    ownerId: string,
  ): Promise<SecurityExecutionRow[]> {
    const securityBusiness =
      await this.securityBusinessesProvider.getSecurityBusinessByIdentifierLoader.load({
        ownerId,
        type: 'POALIM_SECURITY_KEY',
        value: execution.security,
      });
    if (!securityBusiness) {
      return [];
    }

    const executions = await getSecurityExecutionsByBusinessIds.run(
      { businessIds: [securityBusiness.id] },
      this.db,
    );
    return executions.filter(
      row =>
        row.owner_id === ownerId &&
        row.bank_number === execution.bank_number &&
        row.branch_number === execution.branch_number &&
        row.account_number === execution.account_number,
    );
  }

  /** Memo for {@link getSecurityOwnerHistory}; the provider lives for one operation. */
  private ownerHistoryCache = new Map<string, Promise<SecurityExecutionRow[]>>();

  /**
   * Every ingested execution of an execution's security across all of the owner's portfolio
   * accounts, oldest first — the history a disposal's FIFO purchase cost is replayed from.
   *
   * A sale draws only on its own account's lots; the history spans the owner's accounts so that a
   * holding transferred between two of them brings its lots, and their cost, across. Addressed
   * through the security business like {@link getSecurityAccountHistory}, and narrowed to the
   * owner, since reads follow the request's whole business scope. Empty when the key belongs to no
   * security business.
   */
  public async getSecurityOwnerHistory(
    execution: Pick<SecurityExecutionRow, 'security'>,
    ownerId: string,
  ): Promise<SecurityExecutionRow[]> {
    const securityBusiness =
      await this.securityBusinessesProvider.getSecurityBusinessByIdentifierLoader.load({
        ownerId,
        type: 'POALIM_SECURITY_KEY',
        value: execution.security,
      });
    if (!securityBusiness) {
      return [];
    }

    const cacheKey = `${ownerId}:${securityBusiness.id}`;
    let cached = this.ownerHistoryCache.get(cacheKey);
    if (!cached) {
      cached = getSecurityExecutionsByBusinessIds
        .run({ businessIds: [securityBusiness.id] }, this.db)
        .then(executions => executions.filter(row => row.owner_id === ownerId));
      this.ownerHistoryCache.set(cacheKey, cached);
    }
    return cached;
  }

  /** Memo for {@link getTransferCounterpart}, by the owner history it pairs */
  private transferPairsCache = new WeakMap<
    readonly SecurityExecutionRow[],
    Map<string, SecurityExecutionRow>
  >();

  /**
   * A transfer's other leg: the transfer in a transfer out of one of the owner's accounts arrived
   * as, or the transfer out a transfer in arrived from — paired over the owner's history of the
   * security exactly as FIFO pairs them to move lots. Null for an unpaired transfer, and for any
   * other execution.
   */
  public async getTransferCounterpart(
    execution: SecurityExecutionRow,
  ): Promise<SecurityExecutionRow | null> {
    const tradeType = tryToSecurityTradeType(execution.trade_type);
    if (!tradeType || !TRANSFER_TRADE_TYPES.has(tradeType)) {
      return null;
    }

    const history = await this.getSecurityOwnerHistory(execution, execution.owner_id);
    let pairs = this.transferPairsCache.get(history);
    if (!pairs) {
      pairs = pairSecurityTransfers(history);
      this.transferPairsCache.set(history, pairs);
    }
    return pairs.get(execution.id) ?? null;
  }

  /** Memo for {@link getSecurityOwnerTransactionsByExecutionId}; the provider lives for one operation. */
  private ownerTransactionsCache = new Map<string, Promise<Map<string, MatchedTransaction>>>();

  /**
   * The cash transaction each of the owner's executions of an execution's security was paired
   * with, by execution id — the movement a purchase's cost was booked from, and so the rate it was
   * booked at. Pairs the same way the security's own page does (see
   * {@link getSecurityBusinessHistory}). Empty when the key belongs to no security business.
   */
  public async getSecurityOwnerTransactionsByExecutionId(
    execution: Pick<SecurityExecutionRow, 'security'>,
    ownerId: string,
  ): Promise<Map<string, MatchedTransaction>> {
    const securityBusiness =
      await this.securityBusinessesProvider.getSecurityBusinessByIdentifierLoader.load({
        ownerId,
        type: 'POALIM_SECURITY_KEY',
        value: execution.security,
      });
    if (!securityBusiness) {
      return new Map();
    }

    const cacheKey = `${ownerId}:${securityBusiness.id}`;
    let cached = this.ownerTransactionsCache.get(cacheKey);
    if (!cached) {
      cached = this.getSecurityBusinessHistory(securityBusiness.id, ownerId).then(
        ({ transactionByExecutionId }) => transactionByExecutionId,
      );
      this.ownerTransactionsCache.set(cacheKey, cached);
    }
    return cached;
  }

  /**
   * The whole ingested life of one security business: every execution of every Poalim key it
   * is known by, each carrying the cash movement (and so the charge) behind it.
   *
   * The candidate transactions are the security business's own — which is what the counterparty
   * now is for a resolved trade — so this reads the same pairing the charge view shows, from
   * the other end. Fees are left out, as on the charge side.
   */
  public async getSecurityBusinessHistory(businessId: string, ownerId: string) {
    const [executions, transactions] = await Promise.all([
      getSecurityExecutionsByBusinessIds.run({ businessIds: [businessId] }, this.db),
      this.transactionsProvider.getTransactionsByFilters({
        businessIDs: [businessId],
        ownerIDs: [ownerId],
      }),
    ]);

    const accountTuples = await this.getAccountTuples([
      ...new Set(transactions.map(transaction => transaction.account_id).filter(Boolean)),
    ] as string[]);

    const transactionByExecutionId = matchExecutionsToTransactions(
      (transactions as unknown as Array<MatchedTransaction & { is_fee: boolean | null }>).filter(
        transaction => !transaction.is_fee,
      ),
      executions,
      accountTuples,
    );

    return { executions, transactionByExecutionId };
  }

  /**
   * Every ingested execution of every security business the tenant has, grouped by the business
   * it belongs to. Each business gets an entry, so "nothing ingested" is distinguishable from
   * "not a security".
   *
   * One query for the whole portfolio: `getSecurityExecutionsByBusinessIds` joins the identifier
   * bridge, so every business can be asked for at once and each row already knows which one it
   * belongs to — including when two businesses trade the same security under the same Poalim key,
   * which the key alone cannot tell apart.
   *
   * Unlike `getSecurityBusinessHistory` this never looks at transactions or accounts — those
   * exist only to pair an execution with the cash movement behind it, which a position does not
   * need, and they cost a transactions query plus an account lookup per security.
   */
  public async getExecutionsBySecurityBusiness(): Promise<Map<string, SecurityExecutionRow[]>> {
    const securityBusinesses = await this.securityBusinessesProvider.getAllSecurityBusinesses();

    const executionsByBusinessId = new Map<string, SecurityExecutionRow[]>(
      securityBusinesses.map(securityBusiness => [securityBusiness.id, []]),
    );
    if (securityBusinesses.length === 0) {
      return executionsByBusinessId;
    }

    // ORDER BY trade_date, id is global to the result, so each business's slice stays
    // chronological — which is what `calculateSecurityPosition` reads its currency off.
    const executions = await getSecurityExecutionsByBusinessIds.run(
      { businessIds: securityBusinesses.map(securityBusiness => securityBusiness.id) },
      this.db,
    );

    for (const execution of executions) {
      // The bucket comes from the join, so an execution can only ever land under the business
      // whose owner *and* key it matches.
      executionsByBusinessId.get(execution.security_business_id)?.push(execution);
    }

    return executionsByBusinessId;
  }

  /**
   * Which securities a filter names.
   *
   * `securityBusinessIds`, `isins` and `symbols` are three ways of naming the same axis, so they
   * union with each other rather than intersecting — asking for one ISIN and one symbol means
   * both securities, not the empty overlap. Naming none of them means every security.
   *
   * Resolved against the request-memoized `getAllSecurityBusinesses()` rather than with three
   * more queries: it is one round trip already paid for, and going through it means an id that
   * is not a security business of this tenant resolves to nothing instead of reaching the
   * executions feed.
   */
  private async resolveFilterSecurityBusinessIds(
    filters: SecurityExecutionsFilterInput,
  ): Promise<string[]> {
    const securityBusinesses = await this.securityBusinessesProvider.getAllSecurityBusinesses();

    const requestedIds = new Set(filters.securityBusinessIds?.filter(Boolean) ?? []);
    const requestedIsins = new Set(filters.isins?.filter(Boolean) ?? []);
    // The bank is inconsistent about symbol case across its two feeds; match case-insensitively.
    const requestedSymbols = new Set(
      (filters.symbols?.filter(Boolean) ?? []).map(symbol => symbol.toLowerCase()),
    );

    if (requestedIds.size === 0 && requestedIsins.size === 0 && requestedSymbols.size === 0) {
      return securityBusinesses.map(securityBusiness => securityBusiness.id);
    }

    return securityBusinesses
      .filter(
        securityBusiness =>
          requestedIds.has(securityBusiness.id) ||
          requestedIsins.has(securityBusiness.isin) ||
          (securityBusiness.symbol != null &&
            requestedSymbols.has(securityBusiness.symbol.toLowerCase())),
      )
      .map(securityBusiness => securityBusiness.id);
  }

  /**
   * A page of executions across securities, newest first.
   *
   * Two paths, because charge links and pagination do not compose. Without them the filter
   * pushes straight into SQL and the page is a `LIMIT`/`OFFSET` slice. With them the pairing has
   * to see a security's *whole* history — `matchExecutionsToTransactions` is greedy and
   * one-to-one over the sets it is handed, so pairing a page's slice would let an execution on
   * page 2 claim the cash movement that belongs to one on page 1, and the same execution would
   * report a different charge at a different page size. So that path reuses
   * `getSecurityBusinessHistory` per security, unpaginated, and slices in memory — which is why
   * it is capped at {@link MAX_CHARGE_LINK_SECURITIES} securities.
   */
  public async getSecurityExecutionsPage(params: {
    filters: SecurityExecutionsFilterInput;
    page: number;
    limit: number;
    includeCharges: boolean;
    ownerId: string;
  }): Promise<PaginatedSecurityExecutionsProto> {
    const { filters, page, limit, includeCharges, ownerId } = params;
    const empty: PaginatedSecurityExecutionsProto = {
      nodes: [],
      totalRecords: 0,
      currentPage: page,
      pageSize: limit,
    };

    const businessIds = await this.resolveFilterSecurityBusinessIds(filters);
    if (businessIds.length === 0) {
      return empty;
    }

    if (includeCharges) {
      if (businessIds.length > MAX_CHARGE_LINK_SECURITIES) {
        throw new GraphQLError(
          `includeCharges resolves to ${businessIds.length} securities, more than the ${MAX_CHARGE_LINK_SECURITIES} it can pair at once — narrow securityBusinessIds, isins or symbols, or drop includeCharges.`,
        );
      }
      return this.chargeLinkedExecutionsPage(businessIds, filters, page, limit, ownerId);
    }

    const rawTradeTypes = filters.rawTradeTypes?.filter(Boolean) ?? [];
    const rawTransactionTypes = filters.rawTransactionTypes?.filter(Boolean) ?? [];

    const rows = await getFilteredSecurityExecutions.run(
      {
        businessIds: [...businessIds],
        isTradeTypes: rawTradeTypes.length ? 1 : 0,
        isTransactionTypes: rawTransactionTypes.length ? 1 : 0,
        // pgtyped requires a non-empty array for `IN $$list`; the matching `is*` flag
        // short-circuits the predicate, so the placeholder is never compared.
        tradeTypes: rawTradeTypes.length ? [...rawTradeTypes] : [null],
        transactionTypes: rawTransactionTypes.length ? [...rawTransactionTypes] : [null],
        fromTradeDate: filters.fromTradeDate ?? null,
        toTradeDate: filters.toTradeDate ?? null,
        limit,
        offset: page * limit,
      },
      this.db,
    );

    return {
      // `COUNT(*) OVER ()` is identical on every row of the page.
      totalRecords: rows.length ? Number(rows[0].total_count) : 0,
      currentPage: page,
      pageSize: limit,
      // The security business comes off the join, so it is known for every row rather than
      // looked up afterwards.
      nodes: rows.map(row => ({
        id: row.id,
        execution: row,
        securityBusinessId: row.security_business_id,
        transaction: null,
      })),
    };
  }

  /**
   * The `includeCharges` path: every named security's complete history, paired, then filtered,
   * ordered and sliced in memory. See {@link getSecurityExecutionsPage} for why it cannot be
   * done in SQL.
   */
  private async chargeLinkedExecutionsPage(
    businessIds: readonly string[],
    filters: SecurityExecutionsFilterInput,
    page: number,
    limit: number,
    ownerId: string,
  ): Promise<PaginatedSecurityExecutionsProto> {
    const histories = await Promise.all(
      businessIds.map(businessId => this.getSecurityBusinessHistory(businessId, ownerId)),
    );

    const rawTradeTypes = new Set(filters.rawTradeTypes?.filter(Boolean) ?? []);
    const rawTransactionTypes = new Set(filters.rawTransactionTypes?.filter(Boolean) ?? []);

    const matched: SecurityHistoryExecutionProto[] = [];
    for (const [index, { executions, transactionByExecutionId }] of histories.entries()) {
      const securityBusinessId = businessIds[index]!;
      for (const execution of executions) {
        const tradeDate = execution.trade_date;
        if (filters.fromTradeDate && tradeDate < filters.fromTradeDate) {
          continue;
        }
        if (filters.toTradeDate && tradeDate > filters.toTradeDate) {
          continue;
        }
        if (rawTradeTypes.size && !rawTradeTypes.has(execution.trade_type)) {
          continue;
        }
        if (rawTransactionTypes.size && !rawTransactionTypes.has(execution.transaction_type)) {
          continue;
        }
        matched.push({
          id: execution.id,
          execution,
          securityBusinessId,
          transaction: transactionByExecutionId.get(execution.id) ?? null,
        });
      }
    }

    // Newest first, matching the SQL path's ORDER BY exactly so the two paths cannot disagree
    // about what page 1 is.
    matched.sort(
      (a, b) =>
        compareTimelessDates(b.execution.trade_date, a.execution.trade_date) ||
        b.execution.id.localeCompare(a.execution.id),
    );

    return {
      nodes: matched.slice(page * limit, (page + 1) * limit),
      totalRecords: matched.length,
      currentPage: page,
      pageSize: limit,
    };
  }

  /**
   * The securities a charge's transactions reference, keyed off the security key each
   * description carries, plus those of the executions the charge books directly (passed in as
   * `linkedExecutions` — see `executionsByChargeIdLoader`). Keys with no ingested row are still
   * returned, with a null `details`, so a stale or missing scrape is visible instead of silently
   * dropping data.
   */
  public async getChargeSecurities(
    chargeId: string,
    ownerId: string,
    linkedExecutions: readonly SecurityExecutionRow[] = [],
  ): Promise<ChargeSecurityProto[]> {
    const transactions =
      await this.transactionsProvider.transactionsByChargeIDLoader.load(chargeId);

    const transactionIdsByKey = new Map<string, string[]>();
    for (const transaction of transactions) {
      for (const key of extractTransactionSecurityKeys(transaction)) {
        const transactionIds = transactionIdsByKey.get(key);
        if (transactionIds) {
          transactionIds.push(transaction.id);
        } else {
          transactionIdsByKey.set(key, [transaction.id]);
        }
      }
    }

    const ownLinkedExecutions = linkedExecutions.filter(
      execution => execution.owner_id === ownerId,
    );
    const keySet = new Set([
      ...transactionIdsByKey.keys(),
      ...ownLinkedExecutions.map(execution => execution.security),
    ]);
    if (keySet.size === 0) {
      return [];
    }

    const keys = [...keySet].sort();
    const [details, executionsByKey] = await Promise.all([
      this.securityByKeyLoader.loadMany(keys.map(securityKey => ({ ownerId, securityKey }))),
      transactionIdsByKey.size > 0
        ? this.getMatchedExecutions(transactions)
        : Promise.resolve(new Map<string, SecurityExecutionRow[]>()),
    ]);

    return keys.map((key, index) => {
      const detail = details[index];
      // a linked execution can also be matched to a transaction after a merge; list it once
      const executions = new Map(
        [
          ...(executionsByKey.get(key) ?? []),
          ...ownLinkedExecutions.filter(execution => execution.security === key),
        ].map(execution => [execution.id, execution]),
      );
      return {
        id: `${chargeId}-${key}`,
        chargeId,
        ownerId,
        securityKey: key,
        // loadMany surfaces a rejected key as an Error rather than throwing; treat it
        // the same as "not ingested" so one bad key can't blank the whole section.
        details: detail instanceof Error ? null : (detail as SecurityRow | null),
        transactionIds: transactionIdsByKey.get(key) ?? [],
        executions: [...executions.values()],
      };
    });
  }
}
