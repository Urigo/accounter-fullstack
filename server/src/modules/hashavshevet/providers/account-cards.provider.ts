import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAccountCardsByBusinessIDsQuery,
  IGetAccountCardsBySortCodesParams,
  IGetAccountCardsBySortCodesQuery,
} from '../types.js';

const getAccountCardsBySortCodes = sql<IGetAccountCardsBySortCodesQuery>`
    SELECT ac.*
    FROM accounter_schema.hash_account_cards ac
    WHERE ($isSortCodes = 0 OR ac.sort_code IN $$sortCodesIds);`;

const getAccountCardsByBusinessIDs = sql<IGetAccountCardsByBusinessIDsQuery>`
    SELECT ac.*
    FROM accounter_schema.hash_account_cards ac
    WHERE ($isBusinessIDs = 0 OR ac.business_id IN $$businessIDs);`;

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

  private async batchAccountCardsByBusinessIDs(businessIDs: readonly string[]) {
    const accountCards = await getAccountCardsByBusinessIDs.run(
      {
        isBusinessIDs: businessIDs.length > 0 ? 1 : 0,
        businessIDs,
      },
      this.dbProvider,
    );
    return businessIDs.map(id => accountCards.find(record => record.business_id === id));
  }

  public getAccountCardsByBusinessIDsLoader = new DataLoader(this.batchAccountCardsByBusinessIDs, {
    cache: false,
  });
}
