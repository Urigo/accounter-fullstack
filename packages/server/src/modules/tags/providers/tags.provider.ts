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
  private ALL_TAGS_KEY = 'all-tags';

  constructor(private dbProvider: DBProvider) {}

  public getAllTags() {
    const data = this.cache.get(this.ALL_TAGS_KEY);
    if (data) {
      return data as Array<IGetAllTagsResult>;
    }
    return getAllTags.run(undefined, this.dbProvider).then(data => {
      this.cache.set(this.ALL_TAGS_KEY, data);
      return data;
    });
  }

  public addNewTag(params: IAddNewTagParams) {
    this.cache.delete(this.ALL_TAGS_KEY);
    return addNewTag.run(params, this.dbProvider);
  }

  public async renameTag(params: IRenameTagParams) {
    if (params.id) {
      const tag = await this.getTagByIDLoader.load(params.id);
      if (tag) {
        this.clearTagCacheByName(tag.name!);
        this.clearTagCacheById(tag.id!);
      }
    }
    if (params.newName) {
      this.clearTagCacheByName(params.newName);
    }
    return renameTag.run(params, this.dbProvider);
  }

  public async deleteTag(params: IDeleteTagParams) {
    if (params.id) {
      const tag = await this.getTagByIDLoader.load(params.id);
      if (tag) {
        this.clearTagCacheByName(tag.name!);
        this.clearTagCacheById(tag.id!);
      }
    }
    return deleteTag.run(params, this.dbProvider);
  }

  public async updateTagParent(params: IUpdateTagParentParams) {
    if (params.id) {
      const tag = await this.getTagByIDLoader.load(params.id);
      if (tag) {
        this.clearTagCacheByName(tag.name!);
        this.clearTagCacheById(tag.id!);
      }
    }
    return updateTagParent.run(params, this.dbProvider);
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

  public clearCache() {
    this.cache.clear();
  }

  public clearTagCacheByName(name: string) {
    this.cache.delete(this.ALL_TAGS_KEY);
    this.cache.delete(`tag-name-${name}`);
  }

  public clearTagCacheById(id: string) {
    this.cache.delete(this.ALL_TAGS_KEY);
    this.cache.delete(`tag-id-${id}`);
  }
}
