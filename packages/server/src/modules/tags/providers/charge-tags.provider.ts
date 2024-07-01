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
  IGetTagsByChargeIDsResult,
  IInsertChargeTagParams,
  IInsertChargeTagQuery,
  IUpdateChargeTagPartParams,
  IUpdateChargeTagPartQuery,
} from '../types.js';

const getTagsByChargeIDs = sql<IGetTagsByChargeIDsQuery>`
    SELECT ct.charge_id, ct.part, t.*
    FROM accounter_schema.charge_tags ct
    LEFT JOIN accounter_schema.extended_tags t
    ON ct.tag_id = t.id
    WHERE ct.charge_id IN $$chargeIDs;`;

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
  constructor(private dbProvider: DBProvider) {}

  private async batchTagsByChargeID(chargeIDs: readonly string[]) {
    const tagsArray = await getTagsByChargeIDs.run({ chargeIDs }, this.dbProvider);
    const tagsByChargeId = new Map<string, IGetTagsByChargeIDsResult[]>();
    tagsArray.map(tag => {
      if (tagsByChargeId.has(tag.charge_id)) {
        tagsByChargeId.get(tag.charge_id)!.push(tag);
      } else {
        tagsByChargeId.set(tag.charge_id, [tag]);
      }
    });
    return chargeIDs.map(id => tagsByChargeId.get(id) ?? []);
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

  public async insertChargeTag(params: IInsertChargeTagParams) {
    return insertChargeTag.run(params, this.dbProvider);
  }

  public async updateChargeTagPart(params: IUpdateChargeTagPartParams) {
    return updateChargeTagPart.run(params, this.dbProvider);
  }
}
