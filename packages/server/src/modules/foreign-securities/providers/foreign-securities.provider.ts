import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { extractSecurityKeys } from '../helpers/security-key.helper.js';
import type { ChargeSecurityProto, IGetSecuritiesByKeysQuery, SecurityRow } from '../types.js';

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

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ForeignSecuritiesProvider {
  constructor(
    private db: TenantAwareDBClient,
    private transactionsProvider: TransactionsProvider,
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
    const details = await this.securityByKeyLoader.loadMany(keys);

    return keys.map((key, index) => {
      const detail = details[index];
      return {
        id: `${chargeId}-${key}`,
        securityKey: key,
        // loadMany surfaces a rejected key as an Error rather than throwing; treat it
        // the same as "not ingested" so one bad key can't blank the whole section.
        details: detail instanceof Error ? null : (detail as SecurityRow | null),
        transactionIds: transactionIdsByKey.get(key) ?? [],
      };
    });
  }
}
