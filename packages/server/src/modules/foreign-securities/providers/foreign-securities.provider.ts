import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString } from '../../../shared/helpers/misc.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from '../../financial-accounts/providers/financial-bank-accounts.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import {
  matchExecutionsToTransactions,
  matchSecurityExecutions,
  type AccountTuple,
  type MatchableTransaction,
} from '../helpers/match-security-executions.helper.js';
import { extractSecurityKeys } from '../helpers/security-key.helper.js';
import type {
  ChargeSecurityProto,
  IGetFilteredSecurityExecutionsQuery,
  IGetSecuritiesByKeysQuery,
  IGetSecurityExecutionsByKeysQuery,
  IGetSecurityExecutionsQuery,
  PaginatedSecurityExecutionsProto,
  SecurityExecutionRow,
  SecurityExecutionsFilterInput,
  SecurityHistoryExecutionProto,
  SecurityRow,
} from '../types.js';
import { SecurityBusinessesProvider } from './security-businesses.provider.js';

/**
 * No owner_id predicate: accounter_schema.poalim_securities is FORCE RLS with a
 * tenant_isolation policy, so going through TenantAwareDBClient scopes this to the
 * acting tenant. The dedup key includes branch/account, so one tenant can hold the
 * same security in several accounts — DISTINCT ON keeps the freshest scrape.
 */
const getSecuritiesByKeys = sql<IGetSecuritiesByKeysQuery>`
  SELECT DISTINCT ON (security_key)
         id, security_key, eng_name, heb_name, symbol, eng_symbol, heb_symbol,
         item_type, stock_type, exchange, currency_code, is_etf, is_foreign, as_of_date
  FROM accounter_schema.poalim_securities
  WHERE security_key = ANY($securityKeys!)
  ORDER BY security_key, as_of_date DESC;`;

/**
 * A prefilter, not the match itself: the ANY(...) predicates form a cross-product over the
 * charge's keys, accounts and settlement days. `matchSecurityExecutions` does the per-row
 * pairing in memory, where the account tuple, currency and direction are checked together.
 *
 * Tenant scoping is RLS again (FORCE ROW LEVEL SECURITY + tenant_isolation), hence no
 * owner_id predicate.
 */
const getSecurityExecutions = sql<IGetSecurityExecutionsQuery>`
  SELECT
    id,
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
    management_fees_value_trade_currency,
    israe_tax_value,
    nominal_profit_loss_nis,
    real_profit_loss_nis,
    payment_type,
    symbol,
    isin
  FROM accounter_schema.poalim_securities_transactions
  WHERE security = ANY($securities!)
    AND bank_number = ANY($bankNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND account_number = ANY($accountNumbers!)
    AND value_date = ANY($valueDates!);`;

/**
 * Every ingested execution of the given securities, unbounded by charge or date — the whole
 * life of an instrument, which is what its business page shows. RLS scopes it to the tenant.
 */
const getSecurityExecutionsByKeys = sql<IGetSecurityExecutionsByKeysQuery>`
  SELECT
    id,
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
    management_fees_value_trade_currency,
    israe_tax_value,
    nominal_profit_loss_nis,
    real_profit_loss_nis,
    payment_type,
    symbol,
    isin
  FROM accounter_schema.poalim_securities_transactions
  WHERE security = ANY($securities!)
  ORDER BY trade_date, id;`;

/**
 * The paginated, filtered slice `Query.securityExecutions` serves.
 *
 * Newest first, deliberately the opposite of `getSecurityExecutionsByKeys`: that one feeds
 * `calculateSecurityPosition`, which reads a position's currency off the *first* execution and
 * so depends on chronological order. This one is read by a human asking what happened lately.
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
    id,
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
    management_fees_value_trade_currency,
    israe_tax_value,
    nominal_profit_loss_nis,
    real_profit_loss_nis,
    payment_type,
    symbol,
    isin,
    COUNT(*) OVER () AS total_count
  FROM accounter_schema.poalim_securities_transactions
  WHERE security IN $$securities
    AND ($isTradeTypes = 0 OR trade_type IN $$tradeTypes)
    AND ($isTransactionTypes = 0 OR transaction_type IN $$transactionTypes)
    AND ($fromTradeDate::DATE IS NULL OR trade_date >= $fromTradeDate)
    AND ($toTradeDate::DATE IS NULL OR trade_date <= $toTradeDate)
  ORDER BY trade_date DESC, id DESC
  LIMIT $limit! OFFSET $offset!;`;

/**
 * How many securities `includeCharges` will pair at once.
 *
 * Each one costs its whole execution history plus a transactions query, because the pairing is
 * only correct over a complete set (see `matchExecutionsToTransactions`). The cap is what keeps
 * "every trade I ever made, with charges" from turning into a portfolio-wide fan-out.
 */
export const MAX_CHARGE_LINK_SECURITIES = 10;

/** What the reverse match needs off a transaction, charge included so a row can link out. */
type MatchedTransaction = MatchableTransaction & { charge_id: string };

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

  private async batchSecuritiesByKeys(securityKeys: readonly string[]) {
    const securities = await getSecuritiesByKeys.run({ securityKeys: [...securityKeys] }, this.db);
    // DISTINCT ON in the query guarantees one row per key, so a plain Map is enough.
    const securityByKey = new Map(securities.map(security => [security.security_key, security]));
    return securityKeys.map(key => securityByKey.get(key) ?? null);
  }

  public securityByKeyLoader = new DataLoader((keys: readonly string[]) =>
    this.batchSecuritiesByKeys(keys),
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

  /**
   * Ingested portfolio executions matched to the charge's transactions, grouped by security
   * key. Returns an empty map when the charge touches no resolvable Poalim account, so a
   * charge whose accounts predate the bank-account backfill degrades to "no activity" rather
   * than erroring.
   */
  private async getMatchedExecutions(
    transactions: readonly MatchableTransaction[],
    securityKeys: readonly string[],
  ): Promise<Map<string, SecurityExecutionRow[]>> {
    const accountTuples = await this.getAccountTuples([
      ...new Set(transactions.map(transaction => transaction.account_id)),
    ]);
    if (accountTuples.size === 0) {
      return new Map();
    }

    // An execution settles on the day its cash leg is debited, so those are the only days
    // worth fetching. A transaction with no debit date can never pair up.
    const valueDates = transactions
      .map(transaction => transaction.debit_date_override ?? transaction.debit_date)
      .filter((date): date is Date => date != null);
    if (valueDates.length === 0) {
      return new Map();
    }

    const tuples = [...accountTuples.values()];
    const candidates = await getSecurityExecutions.run(
      {
        securities: [...securityKeys],
        bankNumbers: [...new Set(tuples.map(tuple => tuple.bankNumber))],
        branchNumbers: [...new Set(tuples.map(tuple => tuple.branchNumber))],
        accountNumbers: [...new Set(tuples.map(tuple => tuple.accountNumber))],
        valueDates,
      },
      this.db,
    );

    return matchSecurityExecutions(transactions, candidates, accountTuples);
  }

  /**
   * The whole ingested life of one security business: every execution of every Poalim key it
   * is known by, each carrying the cash movement (and so the charge) behind it.
   *
   * The candidate transactions are the security business's own — which is what the counterparty
   * now is for a resolved trade — so this reads the same pairing the charge view shows, from
   * the other end.
   */
  public async getSecurityBusinessHistory(businessId: string, ownerId: string) {
    const identifiers =
      await this.securityBusinessesProvider.getIdentifiersByBusinessIdLoader.load(businessId);
    const securityKeys = identifiers
      .filter(identifier => identifier.identifier_type === 'POALIM_SECURITY_KEY')
      .map(identifier => identifier.identifier_value);

    if (securityKeys.length === 0) {
      return { executions: [], transactionByExecutionId: new Map<string, MatchedTransaction>() };
    }

    const [executions, transactions] = await Promise.all([
      getSecurityExecutionsByKeys.run({ securities: securityKeys }, this.db),
      this.transactionsProvider.getTransactionsByFilters({
        businessIDs: [businessId],
        ownerIDs: [ownerId],
      }),
    ]);

    const accountTuples = await this.getAccountTuples([
      ...new Set(transactions.map(transaction => transaction.account_id).filter(Boolean)),
    ] as string[]);

    const transactionByExecutionId = matchExecutionsToTransactions(
      transactions as unknown as MatchedTransaction[],
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
   * One query for the whole portfolio: `getSecurityExecutionsByKeys` already filters on
   * `security = ANY(...)` and returns the key on every row, so the union of every business's
   * Poalim keys can be asked for at once and split back up in memory.
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

    const businessIdByKey = await this.getBusinessIdBySecurityKey(
      securityBusinesses.map(securityBusiness => securityBusiness.id),
    );

    if (businessIdByKey.size === 0) {
      return executionsByBusinessId;
    }

    // ORDER BY trade_date, id is global to the result, so each key's slice stays chronological —
    // which is what `calculateSecurityPosition` reads its currency off.
    const executions = await getSecurityExecutionsByKeys.run(
      { securities: [...businessIdByKey.keys()] },
      this.db,
    );

    for (const execution of executions) {
      const businessId = businessIdByKey.get(execution.security);
      if (!businessId) {
        continue;
      }
      // An identifier can outlive the business it pointed at; skip rather than invent a bucket.
      executionsByBusinessId.get(businessId)?.push(execution);
    }

    return executionsByBusinessId;
  }

  /**
   * Poalim security key -> the security business it belongs to, for the given businesses.
   *
   * The executions table is keyed by the bank's proprietary key, and one business can carry
   * several of them — that is what the identifiers bridge is for — so every read of the
   * executions feed has to invert the relation first. The unique index on
   * `(owner_id, identifier_type, identifier_value)` is what makes one key resolve to exactly one
   * business, so a plain Map is enough.
   *
   * One batched query behind the loader, not one per business.
   */
  private async getBusinessIdBySecurityKey(
    businessIds: readonly string[],
  ): Promise<Map<string, string>> {
    const identifierLists =
      await this.securityBusinessesProvider.getIdentifiersByBusinessIdLoader.loadMany([
        ...businessIds,
      ]);

    const businessIdByKey = new Map<string, string>();
    for (const identifiers of identifierLists) {
      // loadMany reports a rejected key as an Error rather than throwing; one bad business must
      // not blank the whole list.
      if (identifiers instanceof Error) {
        continue;
      }
      for (const identifier of identifiers) {
        if (identifier.identifier_type === 'POALIM_SECURITY_KEY') {
          businessIdByKey.set(identifier.identifier_value, identifier.business_id);
        }
      }
    }

    return businessIdByKey;
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

    const businessIdByKey = await this.getBusinessIdBySecurityKey(businessIds);
    if (businessIdByKey.size === 0) {
      return empty;
    }

    const rawTradeTypes = filters.rawTradeTypes?.filter(Boolean) ?? [];
    const rawTransactionTypes = filters.rawTransactionTypes?.filter(Boolean) ?? [];

    const rows = await getFilteredSecurityExecutions.run(
      {
        securities: [...businessIdByKey.keys()],
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
      nodes: rows.flatMap(row => {
        const securityBusinessId = businessIdByKey.get(row.security);
        // Cannot happen — the rows come from `security IN $$securities`, built from these very
        // keys — but an identifier can outlive the business it pointed at, so skip rather than
        // assert a business id into existence.
        return securityBusinessId
          ? [{ id: row.id, execution: row, securityBusinessId, transaction: null }]
          : [];
      }),
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
        // Both sides are calendar dates; the timeless string compares as the day, which the raw
        // Date does not once a DST boundary is between them.
        const tradeDate = dateToTimelessDateString(execution.trade_date);
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
        b.execution.trade_date.getTime() - a.execution.trade_date.getTime() ||
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
   * description carries. Keys with no ingested row are still returned, with a null
   * `details`, so a stale or missing scrape is visible instead of silently dropping data.
   */
  public async getChargeSecurities(chargeId: string): Promise<ChargeSecurityProto[]> {
    const transactions =
      await this.transactionsProvider.transactionsByChargeIDLoader.load(chargeId);

    const transactionIdsByKey = new Map<string, string[]>();
    for (const transaction of transactions) {
      for (const key of extractSecurityKeys(transaction.source_description)) {
        const transactionIds = transactionIdsByKey.get(key);
        if (transactionIds) {
          transactionIds.push(transaction.id);
        } else {
          transactionIdsByKey.set(key, [transaction.id]);
        }
      }
    }

    if (transactionIdsByKey.size === 0) {
      return [];
    }

    const keys = [...transactionIdsByKey.keys()].sort();
    const [details, executionsByKey] = await Promise.all([
      this.securityByKeyLoader.loadMany(keys),
      this.getMatchedExecutions(transactions, keys),
    ]);

    return keys.map((key, index) => {
      const detail = details[index];
      return {
        id: `${chargeId}-${key}`,
        securityKey: key,
        // loadMany surfaces a rejected key as an Error rather than throwing; treat it
        // the same as "not ingested" so one bad key can't blank the whole section.
        details: detail instanceof Error ? null : (detail as SecurityRow | null),
        transactionIds: transactionIdsByKey.get(key) ?? [],
        executions: executionsByKey.get(key) ?? [],
      };
    });
  }
}
