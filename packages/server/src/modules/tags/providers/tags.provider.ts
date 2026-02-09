import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
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
  scope: Scope.Operation,
  global: true,
})
export class TagsProvider {
  constructor(private dbProvider: DBProvider) {}

  private allTagsCache: Promise<IGetAllTagsResult[]> | null = null;
  public getAllTags() {
    if (this.allTagsCache) {
      return this.allTagsCache;
    }
    this.allTagsCache = getAllTags.run(undefined, this.dbProvider).then(tags => {
      // Prime the DataLoaders with the fetched tags
      tags.map(tag => {
        if (tag?.id) {
          this.getTagByIDLoader.prime(tag.id, tag);
        }
        if (tag?.name) {
          this.getTagByNameLoader.prime(tag.name, tag);
        }
      });
      return tags;
    });
    return this.allTagsCache;
  }

  private async batchTagsByID(tagIDs: readonly string[]) {
    const tags = await getTagsByIDs.run({ tagIDs }, this.dbProvider);
    return tagIDs.map(id => tags.find(tag => tag.id === id));
  }

  public getTagByIDLoader = new DataLoader((keys: readonly string[]) => this.batchTagsByID(keys));

  private async batchTagsByNames(tagNames: readonly string[]) {
    const tags = await getTagsByNames.run({ tagNames }, this.dbProvider);
    return tagNames.map(name => tags.find(tag => tag.name === name));
  }

  public getTagByNameLoader = new DataLoader((keys: readonly string[]) =>
    this.batchTagsByNames(keys),
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
    this.getTagByIDLoader.clearAll();
    this.getTagByNameLoader.clearAll();
  }
}
