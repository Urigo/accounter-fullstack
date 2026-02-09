import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import {
  IDeleteTemplateParams,
  IDeleteTemplateQuery,
  IGetTemplateParams,
  IGetTemplateQuery,
  IGetTemplatesByOwnerIdsQuery,
  IInsertTemplateParams,
  IInsertTemplateQuery,
  IUpdateTemplateNameParams,
  IUpdateTemplateNameQuery,
  IUpdateTemplateParams,
  IUpdateTemplateQuery,
} from '../types.js';

const getTemplate = sql<IGetTemplateQuery>`
SELECT *
FROM accounter_schema.dynamic_report_templates
WHERE name = $name AND owner_id = $ownerId;`;

const getTemplatesByOwnerIds = sql<IGetTemplatesByOwnerIdsQuery>`
SELECT *
FROM accounter_schema.dynamic_report_templates
WHERE owner_id IN $$ownerIds;`;

const updateTemplate = sql<IUpdateTemplateQuery>`
  UPDATE accounter_schema.dynamic_report_templates
  SET template = $template
  WHERE name = $name AND owner_id = $ownerId
  RETURNING *;`;

const updateTemplateName = sql<IUpdateTemplateNameQuery>`
  UPDATE accounter_schema.dynamic_report_templates
  SET name = $newName
  WHERE name = $prevName AND owner_id = $ownerId
  RETURNING *;`;

const insertTemplate = sql<IInsertTemplateQuery>`
  INSERT INTO accounter_schema.dynamic_report_templates (name, owner_id, template)
  VALUES ($name, $ownerId, $template)
  RETURNING *;`;

const deleteTemplate = sql<IDeleteTemplateQuery>`
  DELETE FROM accounter_schema.dynamic_report_templates
  WHERE name = $name AND owner_id = $ownerId
  RETURNING name;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DynamicReportProvider {
  constructor(private dbProvider: DBProvider) {}

  public async getTemplate(params: IGetTemplateParams) {
    return getTemplate.run(params, this.dbProvider).then(res => {
      const [template] = res;
      return template;
    });
  }

  private async batchTemplatesByOwnerIdLoader(ownerIds: readonly string[]) {
    const templates = await getTemplatesByOwnerIds.run({ ownerIds }, this.dbProvider);
    return ownerIds.map(id => templates.filter(template => template.owner_id === id));
  }

  public getTemplatesByOwnerIdLoader = new DataLoader((ownerIds: readonly string[]) =>
    this.batchTemplatesByOwnerIdLoader(ownerIds),
  );

  public async updateTemplate(params: IUpdateTemplateParams) {
    if (params.name && params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    return updateTemplate.run(params, this.dbProvider);
  }

  public async updateTemplateName(params: IUpdateTemplateNameParams) {
    if (params.prevName && params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    return updateTemplateName.run(params, this.dbProvider);
  }

  public insertTemplate(params: IInsertTemplateParams) {
    if (params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    return insertTemplate.run(params, this.dbProvider);
  }

  public async deleteTemplate(params: IDeleteTemplateParams) {
    if (params.name && params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    return deleteTemplate.run(params, this.dbProvider);
  }

  public async invalidateByOwnerId(ownerId: string) {
    this.getTemplatesByOwnerIdLoader.clear(ownerId);
  }

  public clearCache() {
    this.getTemplatesByOwnerIdLoader.clearAll();
  }
}
