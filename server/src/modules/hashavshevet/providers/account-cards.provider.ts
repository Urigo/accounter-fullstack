import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAccountCardsByKeysQuery,
  IGetAccountCardsBySortCodesParams,
  IGetAccountCardsBySortCodesQuery,
} from '../types.js';

const getAccountCardsBySortCodes = sql<IGetAccountCardsBySortCodesQuery>`
    SELECT ac.*
    FROM accounter_schema.hash_account_cards ac
    WHERE ($isSortCodes = 0 OR ac.sort_code IN $$sortCodesIds);`;

const getAccountCardsByKeys = sql<IGetAccountCardsByKeysQuery>`
    SELECT ac.*
    FROM accounter_schema.hash_account_cards ac
    WHERE ($isKeys = 0 OR ac.key IN $$keys);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AccountCardsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAccountCardsBySortCodes(params: IGetAccountCardsBySortCodesParams) {
    return getAccountCardsBySortCodes.run(params, this.dbProvider);
  }

  private async batchAccountCardsBySortCodes(sortCodesIds: readonly number[]) {
    const accountCards = await getAccountCardsBySortCodes.run(
      {
        isSortCodes: sortCodesIds.length > 0 ? 1 : 0,
        sortCodesIds,
      },
      this.dbProvider,
    );
    return sortCodesIds.map(id => accountCards.filter(record => record.sort_code === id));
  }

  public getAccountCardsBySortCodesLoader = new DataLoader(
    (keys: readonly number[]) => this.batchAccountCardsBySortCodes(keys),
    {
      cache: false,
    },
  );

  private async batchAccountCardsByKeys(keys: readonly string[]) {
    const accountCards = await getAccountCardsByKeys.run(
      {
        isKeys: keys.length > 0 ? 1 : 0,
        keys,
      },
      this.dbProvider,
    );
    return keys.map(key => accountCards.find(record => record.key === key));
  }

  public getAccountCardsByKeysLoader = new DataLoader(this.batchAccountCardsByKeys, {
    cache: false,
  });
}
