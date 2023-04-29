import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { IGetTagsByChargeIDsQuery } from '../types.js';

const getTagsByChargeIDs = sql<IGetTagsByChargeIDsQuery>`
    SELECT *
    FROM accounter_schema.tags
    WHERE charge_id IN $$chargeIDs;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TAgsProvider {
  constructor(private dbProvider: DBProvider) {}

  public addTagCategory(params: { tagName: string }) {
    return this.dbProvider.query('ALTER TYPE tags ADD ATTRIBUTE $1 TEXT;', [params.tagName]);
  }

  public removeTagCategory(params: { tagName: string }) {
    return this.dbProvider.query('ALTER TYPE tags DROP ATTRIBUTE $1 TEXT;', [params.tagName]);
  }

  private async batchTagsByChargeID(params: readonly string[]) {
    const IDS = Array.from(new Set(params));
    const tags = await getTagsByChargeIDs.run({ chargeIDs: IDS }, this.dbProvider);
    return params.map(id => tags.filter(tag => tag.charge_id === id));
  }

  public getTagsByChargeIDLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTagsByChargeID(keys),
    { cache: false },
  );
}
