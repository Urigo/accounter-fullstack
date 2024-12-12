import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IAddNewTagParams,
  IAddNewTagQuery,
  IDeleteTagParams,
  IDeleteTagQuery,
  IGetAllTagsQuery,
  IGetAllTagsResult,
  IGetTagsByIDsQuery,
  IGetTagsByNamesQuery,
  IRenameTagParams,
  IRenameTagQuery,
  IUpdateTagParentParams,
  IUpdateTagParentQuery,
} from '../types.js';

const getAllTags = sql<IGetAllTagsQuery>`
  SELECT *
  FROM accounter_schema.extended_tags;
`;

const getTagsByIDs = sql<IGetTagsByIDsQuery>`
  SELECT *
  FROM accounter_schema.extended_tags
  WHERE id in $$tagIDs;`;

const getTagsByNames = sql<IGetTagsByNamesQuery>`
  SELECT *
  FROM accounter_schema.extended_tags
  WHERE name in $$tagNames;`;

const addNewTag = sql<IAddNewTagQuery>`
  INSERT INTO accounter_schema.tags (name)
  VALUES ($name)
  RETURNING *;
`;

const renameTag = sql<IRenameTagQuery>`
  UPDATE accounter_schema.tags
  SET name = $newName
  WHERE id = $id
  RETURNING *;
`;

const deleteTag = sql<IDeleteTagQuery>`
  DELETE FROM accounter_schema.tags
  WHERE id = $id
  RETURNING *;
`;

const updateTagParent = sql<IUpdateTagParentQuery>`
  UPDATE accounter_schema.tags
  SET parent = $parentId
  WHERE id = $id
  RETURNING *;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TagsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllTags() {
    const data = this.cache.get('all-tags');
    if (data) {
      return data as Array<IGetAllTagsResult>;
    }
    return getAllTags.run(undefined, this.dbProvider).then(data => {
      this.cache.set('all-tags', data);
      data.map(tag => {
        if (tag.id) this.cache.set(`tag-id-${tag.id}`, tag);
        if (tag.name) this.cache.set(`tag-name-${tag.name}`, tag);
      });
      return data;
    });
  }

  private async batchTagsByID(tagIDs: readonly string[]) {
    const tags = await getTagsByIDs.run({ tagIDs }, this.dbProvider);
    return tagIDs.map(id => tags.find(tag => tag.id === id));
  }

  public getTagByIDLoader = new DataLoader((keys: readonly string[]) => this.batchTagsByID(keys), {
    cacheKeyFn: key => `tag-id-${key}`,
    cacheMap: this.cache,
  });

  private async batchTagsByNames(tagNames: readonly string[]) {
    const tags = await getTagsByNames.run({ tagNames }, this.dbProvider);
    return tagNames.map(name => tags.find(tag => tag.name === name));
  }

  public getTagByNameLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTagsByNames(keys),
    {
      cacheKeyFn: key => `tag-name-${key}`,
      cacheMap: this.cache,
    },
  );

  public addNewTag(params: IAddNewTagParams) {
    this.clearCache();
    return addNewTag.run(params, this.dbProvider);
  }

  public async renameTag(params: IRenameTagParams) {
    this.clearCache();
    return renameTag.run(params, this.dbProvider);
  }

  public async deleteTag(params: IDeleteTagParams) {
    this.clearCache();
    return deleteTag.run(params, this.dbProvider);
  }

  public updateTagParent(params: IUpdateTagParentParams) {
    this.clearCache();
    return updateTagParent.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
