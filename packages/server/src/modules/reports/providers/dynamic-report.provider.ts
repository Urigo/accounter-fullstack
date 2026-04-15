import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import {
  IDeleteTemplateParams,
  IDeleteTemplateQuery,
  IGetTemplateParams,
  IGetTemplateQuery,
  IGetTemplatesByOwnerIdsQuery,
  IInsertTemplateParams,
  IInsertTemplateQuery,
  ILockTemplateParams,
  ILockTemplateQuery,
  IUnlockTemplateParams,
  IUnlockTemplateQuery,
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

const lockTemplate = sql<ILockTemplateQuery>`
  UPDATE accounter_schema.dynamic_report_templates
  SET is_locked = TRUE
  WHERE name = $name AND owner_id = $ownerId
  RETURNING *;`;

const unlockTemplate = sql<IUnlockTemplateQuery>`
  UPDATE accounter_schema.dynamic_report_templates
  SET is_locked = FALSE
  WHERE name = $name AND owner_id = $ownerId
  RETURNING *;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DynamicReportProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  public async getTemplate(params: IGetTemplateParams) {
    return getTemplate.run(params, this.db).then(res => {
      const [template] = res;
      return template;
    });
  }

  private async batchTemplatesByOwnerIdLoader(ownerIds: readonly string[]) {
    const templates = await getTemplatesByOwnerIds.run({ ownerIds }, this.db);
    return ownerIds.map(id => templates.filter(template => template.owner_id === id));
  }

  public getTemplatesByOwnerIdLoader = new DataLoader((ownerIds: readonly string[]) =>
    this.batchTemplatesByOwnerIdLoader(ownerIds),
  );

  public async updateTemplate(params: IUpdateTemplateParams) {
    if (params.name && params.ownerId) {
      await this.assertNotLocked(params.name, params.ownerId);
      this.invalidateByOwnerId(params.ownerId);
    }
    return updateTemplate.run(params, this.db);
  }

  public async updateTemplateName(params: IUpdateTemplateNameParams) {
    if (params.prevName && params.ownerId) {
      await this.assertNotLocked(params.prevName, params.ownerId);
      this.invalidateByOwnerId(params.ownerId);
    }
    return updateTemplateName.run(params, this.db);
  }

  public async insertTemplate(params: IInsertTemplateParams) {
    if (params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return insertTemplate.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public async deleteTemplate(params: IDeleteTemplateParams) {
    if (params.name && params.ownerId) {
      await this.assertNotLocked(params.name, params.ownerId);
      this.invalidateByOwnerId(params.ownerId);
    }
    return deleteTemplate.run(params, this.db);
  }

  public async lockTemplate(params: ILockTemplateParams) {
    if (params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    const results = await lockTemplate.run(params, this.db);
    if (results.length === 0) {
      throw new GraphQLError(`Report template "${params.name}" not found`);
    }
    return results[0];
  }

  public async unlockTemplate(params: IUnlockTemplateParams) {
    if (params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    const results = await unlockTemplate.run(params, this.db);
    if (results.length === 0) {
      throw new GraphQLError(`Report template "${params.name}" not found`);
    }
    return results[0];
  }

  private async assertNotLocked(name: string, ownerId: string): Promise<void> {
    const template = await this.getTemplate({ name, ownerId });
    if (template?.is_locked) {
      throw new GraphQLError(
        `Template "${name}" is locked and cannot be modified. Unlock it first.`,
      );
    }
  }

  public async invalidateByOwnerId(ownerId: string) {
    this.getTemplatesByOwnerIdLoader.clear(ownerId);
  }

  public clearCache() {
    this.getTemplatesByOwnerIdLoader.clearAll();
  }
}
