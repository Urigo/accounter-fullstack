import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
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
  scope: Scope.Singleton,
  global: true,
})
export class DynamicReportProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public async getTemplate(params: IGetTemplateParams) {
    return getTemplate.run(params, this.dbProvider).then(res => {
      const [template] = res;
      if (template) {
        this.cache.set(`template-owner-${template.owner_id}-${template.name}`, template);
      }
      return template;
    });
  }

  private async batchTemplatesByOwnerIdLoader(ownerIds: readonly string[]) {
    const templates = await getTemplatesByOwnerIds.run({ ownerIds }, this.dbProvider);
    templates.map(template =>
      this.cache.set(`template-owner-${template.owner_id}-${template.name}`, template),
    );
    return ownerIds.map(id => templates.filter(template => template.owner_id === id));
  }

  public getTemplatesByOwnerIdLoader = new DataLoader(
    (ownerIds: readonly string[]) => this.batchTemplatesByOwnerIdLoader(ownerIds),
    {
      cacheKeyFn: id => `templates-owner-${id}`,
      cacheMap: this.cache,
    },
  );

  public async updateTemplate(params: IUpdateTemplateParams) {
    if (params.name && params.ownerId) {
      await this.invalidateByNameAndOwnerId(params.name, params.ownerId);
    }
    return updateTemplate.run(params, this.dbProvider);
  }

  public async updateTemplateName(params: IUpdateTemplateNameParams) {
    if (params.prevName && params.ownerId) {
      await this.invalidateByNameAndOwnerId(params.prevName, params.ownerId);
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
      await this.invalidateByNameAndOwnerId(params.name, params.ownerId);
    }
    return deleteTemplate.run(params, this.dbProvider);
  }

  public async invalidateByOwnerId(ownerId: string) {
    const templates = await this.getTemplatesByOwnerIdLoader.load(ownerId);
    await Promise.all(templates.map(({ name }) => this.invalidateByNameAndOwnerId(name, ownerId)));
    this.cache.delete(`templates-owner-${ownerId}`);
  }

  public async invalidateByNameAndOwnerId(name: string, ownerId: string) {
    this.cache.delete(`templates-owner-${ownerId}`);
    this.cache.delete(`template-owner-${ownerId}-${name}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
