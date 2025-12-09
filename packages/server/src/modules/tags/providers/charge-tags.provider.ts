import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../../modules/app-providers/db.provider.js';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import type {
  IClearAllChargeTagsParams,
  IClearAllChargeTagsQuery,
  IClearChargeTagsParams,
  IClearChargeTagsQuery,
  IGetTagIdsByChargeIDsQuery,
  IGetTagsByIDsResult,
  IInsertChargeTagParams,
  IInsertChargeTagQuery,
  IUpdateChargeTagPartParams,
  IUpdateChargeTagPartQuery,
} from '../types.js';
import { TagsProvider } from './tags.provider.js';

const getTagIdsByChargeIDs = sql<IGetTagIdsByChargeIDsQuery>`
    SELECT *
    FROM accounter_schema.charge_tags
    WHERE charge_id IN $$chargeIDs;`;

const clearChargeTags = sql<IClearChargeTagsQuery>`
    DELETE FROM accounter_schema.charge_tags
    WHERE charge_id = $chargeId
    AND tag_id IN $$tagIDs;`;

const clearAllChargeTags = sql<IClearAllChargeTagsQuery>`
    DELETE FROM accounter_schema.charge_tags
    WHERE charge_id = $chargeId;`;

const insertChargeTag = sql<IInsertChargeTagQuery>`
    INSERT INTO accounter_schema.charge_tags (charge_id, tag_id, part) VALUES ($chargeId, $tagId, $part) ON CONFLICT DO NOTHING;`;

const updateChargeTagPart = sql<IUpdateChargeTagPartQuery>`
    UPDATE accounter_schema.charge_tags
    SET
    part = COALESCE(
      $part,
      part
    )
    WHERE charge_id = $chargeId
      AND tag_id = $tagId;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ChargeTagsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(
    private dbProvider: DBProvider,
    private tagsProvider: TagsProvider,
  ) {}

  private async batchTagsByChargeID(chargeIDs: readonly string[]) {
    const tagsMatches = await getTagIdsByChargeIDs.run({ chargeIDs }, this.dbProvider);
    const tags = await this.tagsProvider.getTagByIDLoader
      .loadMany(tagsMatches.map(tag => tag.tag_id))
      .then(tags => tags.filter(tag => tag && !(tag instanceof Error)) as IGetTagsByIDsResult[]);
    const tagsByChargeId = new Map<string, IGetTagsByIDsResult[]>();
    tagsMatches.map(match => {
      const tag = tags.find(tag => tag.id === match.tag_id);
      if (!tag) return;
      if (tagsByChargeId.has(match.charge_id)) {
        tagsByChargeId.get(match.charge_id)!.push(tag);
      } else {
        tagsByChargeId.set(match.charge_id, [tag]);
      }
    });
    return chargeIDs.map(id => tagsByChargeId.get(id) ?? []);
  }

  public getTagsByChargeIDLoader = new DataLoader(
    (chargeIds: readonly string[]) => this.batchTagsByChargeID(chargeIds),
    {
      cacheKeyFn: chargeId => `tags-charge-${chargeId}`,
      cacheMap: this.cache,
    },
  );

  public async clearChargeTags(params: IClearChargeTagsParams) {
    if (params.chargeId) {
      this.invalidateTagsByChargeID(params.chargeId);
    }
    return clearChargeTags.run(params, this.dbProvider);
  }

  public async clearAllChargeTags(params: IClearAllChargeTagsParams) {
    if (params.chargeId) {
      this.invalidateTagsByChargeID(params.chargeId);
    }
    return clearAllChargeTags.run(params, this.dbProvider);
  }

  public async insertChargeTag(params: IInsertChargeTagParams) {
    if (params.chargeId) {
      this.invalidateTagsByChargeID(params.chargeId);
    }
    return insertChargeTag.run(params, this.dbProvider);
  }

  public async updateChargeTagPart(params: IUpdateChargeTagPartParams) {
    if (params.chargeId) {
      this.invalidateTagsByChargeID(params.chargeId);
    }
    return updateChargeTagPart.run(params, this.dbProvider);
  }

  public async invalidateTagsByChargeID(chargeId: string) {
    this.cache.delete(`tags-charge-${chargeId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
