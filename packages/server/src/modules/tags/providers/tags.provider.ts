import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IAddNewTagParams,
  IAddNewTagQuery,
  IDeleteTagParams,
  IDeleteTagQuery,
  IGetAllTagsQuery,
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
  constructor(private dbProvider: DBProvider) {}

  public getAllTags() {
    return getAllTags.run(undefined, this.dbProvider);
  }

  public addNewTag(params: IAddNewTagParams) {
    return addNewTag.run(params, this.dbProvider);
  }

  public renameTag(params: IRenameTagParams) {
    return renameTag.run(params, this.dbProvider);
  }

  public deleteTag(params: IDeleteTagParams) {
    return deleteTag.run(params, this.dbProvider);
  }

  public updateTagParent(params: IUpdateTagParentParams) {
    return updateTagParent.run(params, this.dbProvider);
  }

  private async batchTagsByID(tagIDs: readonly string[]) {
    const tags = await getTagsByIDs.run({ tagIDs }, this.dbProvider);
    return tagIDs.map(id => tags.find(tag => tag.id === id));
  }

  public getTagByIDLoader = new DataLoader((keys: readonly string[]) => this.batchTagsByID(keys), {
    cache: false,
  });

  private async batchTagsByNames(tagNames: readonly string[]) {
    const tags = await getTagsByNames.run({ tagNames }, this.dbProvider);
    return tagNames.map(name => tags.find(tag => tag.name === name));
  }

  public getTagByNameLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTagsByNames(keys),
    {
      cache: false,
    },
  );
}
