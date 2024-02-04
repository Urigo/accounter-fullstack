import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
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
  constructor(private dbProvider: DBProvider) {}

  public addTagCategory(params: { tagName: string }) {
    return this.dbProvider.query('ALTER TYPE accounter_schema.tags_enum ADD VALUE $1::TEXT;', [
      params.tagName,
    ]);
  }

  public updateTagCategory(params: { prevTagName: string; newTagName: string }) {
    return this.dbProvider.query(
      'ALTER TYPE accounter_schema.tags_enum RENAME VALUE $1::TEXT TO $2::TEXT;',
      [params.prevTagName, params.newTagName],
    );
  }

  public removeTagCategory(params: { tagName: string }) {
    return this.dbProvider.query('ALTER TYPE accounter_schema.tags_enum DROP ATTRIBUTE $1::TEXT;', [
      params.tagName,
    ]);
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

  public async clearChargeTags(params: IClearChargeTagsParams) {
    return clearChargeTags.run(params, this.dbProvider);
  }

  public async clearAllChargeTags(params: IClearAllChargeTagsParams) {
    return clearAllChargeTags.run(params, this.dbProvider);
  }

  public async insertChargeTags(params: IInsertChargeTagsParams) {
    return insertChargeTags.run(params, this.dbProvider);
  }

  public getAllTags() {
    return this.dbProvider.query<{ unnest: string }>(
      'SELECT unnest(enum_range(NULL::accounter_schema.tags_enum));',
    );
  }
}
