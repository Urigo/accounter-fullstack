import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
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
  IGetSecuritiesByKeysQuery,
  IGetSecurityExecutionsByKeysQuery,
  IGetSecurityExecutionsQuery,
  SecurityExecutionRow,
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
