import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { sql } from '@pgtyped/runtime';
import { Tag } from '@shared/gql-types';
import { getCacheInstance } from '@shared/helpers';
import type {
  IClearAllChargeTagsParams,
  IClearAllChargeTagsQuery,
  IClearChargeTagsParams,
  IClearChargeTagsQuery,
  IGetTagsByChargeIDsQuery,
  IInsertChargeTagsParams,
  IInsertChargeTagsQuery,
} from '../types.js';

const getTagsByChargeIDs = sql<IGetTagsByChargeIDsQuery>`
    SELECT *
    FROM accounter_schema.tags
    WHERE charge_id IN $$chargeIDs;`;

const clearChargeTags = sql<IClearChargeTagsQuery>`
    DELETE FROM accounter_schema.tags
    WHERE charge_id = $chargeId
    AND tag_name IN $$tagNames;`;

const clearAllChargeTags = sql<IClearAllChargeTagsQuery>`
    DELETE FROM accounter_schema.tags
    WHERE charge_id = $chargeId;`;

const insertChargeTags = sql<IInsertChargeTagsQuery>`
    INSERT INTO accounter_schema.tags (charge_id, tag_name) VALUES ($chargeId, $tagName) ON CONFLICT DO NOTHING;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TagsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(
    private dbProvider: DBProvider,
    private chargesProvider: ChargesProvider,
  ) {}

  public addTagCategory(params: { tagName: string }) {
    return this.dbProvider.query('ALTER TYPE tags ADD VALUE $1::TEXT;', [params.tagName]);
  }

  public updateTagCategory(params: { prevTagName: string; newTagName: string }) {
    this.clearCache();
    return this.dbProvider.query('ALTER TYPE tags RENAME VALUE $1::TEXT TO $2::TEXT;', [
      params.prevTagName,
      params.newTagName,
    ]);
  }

  public removeTagCategory(params: { tagName: string }) {
    this.clearCache();
    return this.dbProvider.query('ALTER TYPE tags DROP ATTRIBUTE $1::TEXT;', [params.tagName]);
  }

  private async batchTagsByChargeID(params: readonly string[]) {
    const IDS = Array.from(new Set(params));
    const tags = await getTagsByChargeIDs.run({ chargeIDs: IDS }, this.dbProvider);
    return params.map(id => tags.filter(tag => tag.charge_id === id));
  }

  private getTagsByChargeIDKey(chargeId: string) {
    return `chargeId-${chargeId}`;
  }

  public getTagsByChargeIDLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTagsByChargeID(keys),
    {
      cacheKeyFn: this.getTagsByChargeIDKey,
      cacheMap: this.cache,
    },
  );

  public async clearChargeTags(params: IClearChargeTagsParams) {
    this.clearCache(params.chargeId ?? undefined);
    return clearChargeTags.run(params, this.dbProvider);
  }

  public async clearAllChargeTags(params: IClearAllChargeTagsParams) {
    this.clearCache(params.chargeId ?? undefined);
    return clearAllChargeTags.run(params, this.dbProvider);
  }

  public async insertChargeTags(params: IInsertChargeTagsParams) {
    this.clearCache(params.chargeId ?? undefined);
    return insertChargeTags.run(params, this.dbProvider);
  }

  public getAllTags() {
    const cachedResult = this.cache.get<Tag[]>('getAllTags');
    if (cachedResult) {
      return Promise.resolve(cachedResult);
    }

    return this.dbProvider
      .query<{ unnest: string }>('SELECT unnest(enum_range(NULL::tags));')
      .then(res => res.rows.map(row => ({ name: row.unnest })))
      .then(result => {
        this.cache.set('getAllTags', result);
        return result;
      });
  }

  public clearCache(chargeId?: string) {
    if (chargeId) {
      this.cache.delete(this.getTagsByChargeIDKey(chargeId));
      this.cache.delete('getAllTags');
    } else {
      this.cache.clear();
    }
    this.chargesProvider.clearCache();
  }
}
