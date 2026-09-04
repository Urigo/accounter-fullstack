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
  IGetSnapshotByIdParams,
  IGetSnapshotByIdQuery,
  IGetSnapshotsMetaByOwnerIdsQuery,
  IGetTemplateParams,
  IGetTemplateQuery,
  IGetTemplatesByOwnerIdsQuery,
  IInsertSnapshotParams,
  IInsertSnapshotQuery,
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
  SET template = $template,
      from_date = COALESCE($fromDate, from_date),
      to_date = COALESCE($toDate, to_date)
  WHERE name = $name AND owner_id = $ownerId
  RETURNING *;`;

const updateTemplateName = sql<IUpdateTemplateNameQuery>`
  UPDATE accounter_schema.dynamic_report_templates
  SET name = $newName
  WHERE name = $prevName AND owner_id = $ownerId
  RETURNING *;`;

const insertTemplate = sql<IInsertTemplateQuery>`
  INSERT INTO accounter_schema.dynamic_report_templates (name, owner_id, template, from_date, to_date)
  VALUES ($name, $ownerId, $template, $fromDate, $toDate)
  RETURNING *;`;

const insertSnapshot = sql<IInsertSnapshotQuery>`
  INSERT INTO accounter_schema.dynamic_report_template_snapshots
    (owner_id, template_name, from_date, to_date, scope_owner_id, tree, leaf_values, created_by)
  VALUES ($ownerId, $templateName, $fromDate, $toDate, $scopeOwnerId, $tree, $leafValues, $createdBy)
  RETURNING *;`;

// Deliberately omits tree and leaf_values: this feeds the snapshot picker, which needs only
// identity and dates, and those two jsonb columns are the whole weight of a row. The payload is
// fetched by id once a baseline is actually chosen.
const getSnapshotsMetaByOwnerIds = sql<IGetSnapshotsMetaByOwnerIdsQuery>`
  SELECT id, owner_id, template_name, from_date, to_date, scope_owner_id, created_by, created_at
  FROM accounter_schema.dynamic_report_template_snapshots
  WHERE owner_id IN $$ownerIds
  ORDER BY created_at DESC;`;

const getSnapshotById = sql<IGetSnapshotByIdQuery>`
  SELECT *
  FROM accounter_schema.dynamic_report_template_snapshots
  WHERE id = $id;`;

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

  private async batchSnapshotsMetaByOwnerIdLoader(ownerIds: readonly string[]) {
    const snapshots = await getSnapshotsMetaByOwnerIds.run({ ownerIds }, this.db);
    return ownerIds.map(id => snapshots.filter(snapshot => snapshot.owner_id === id));
  }

  /**
   * Batched by owner rather than by template: `allDynamicReports` resolves every template of one
   * owner, so one query serves the whole page, and the field resolver filters by template name.
   */
  public getSnapshotsMetaByOwnerIdLoader = new DataLoader((ownerIds: readonly string[]) =>
    this.batchSnapshotsMetaByOwnerIdLoader(ownerIds),
  );

  public async getSnapshotById(params: IGetSnapshotByIdParams) {
    const [snapshot] = await getSnapshotById.run(params, this.db);
    return snapshot;
  }

  public async insertSnapshot(params: IInsertSnapshotParams) {
    if (params.ownerId) {
      this.invalidateByOwnerId(params.ownerId);
    }
    const [snapshot] = await insertSnapshot.run(params, this.db);
    return snapshot;
  }

  /**
   * Saves a template and the baseline captured with it as one unit.
   *
   * The whole premise of change tracking is that a snapshot exists for every save. Writing the two
   * separately would let the template land while the snapshot fails, leaving a save with no
   * baseline and the next visit silently diffing against an older one — so they share a
   * transaction and the save is all-or-nothing.
   */
  public async updateTemplateWithSnapshot(params: {
    template: IUpdateTemplateParams;
    snapshot?: IInsertSnapshotParams | null;
  }) {
    const { name, ownerId } = params.template;
    if (name && ownerId) {
      await this.assertNotLocked(name, ownerId);
      this.invalidateByOwnerId(ownerId);
    }

    return this.db.transaction(async client => {
      const rows = await updateTemplate.run(params.template, client);
      if (rows.length === 0) {
        return undefined;
      }
      if (params.snapshot) {
        await insertSnapshot.run(params.snapshot, client);
      }
      return rows[0];
    });
  }

  public async updateTemplateName(params: IUpdateTemplateNameParams) {
    if (params.prevName && params.ownerId) {
      await this.assertNotLocked(params.prevName, params.ownerId);
      this.invalidateByOwnerId(params.ownerId);
    }
    return updateTemplateName.run(params, this.db);
  }

  /** Creates a template and its first baseline atomically — see `updateTemplateWithSnapshot`. */
  public async insertTemplateWithSnapshot(params: {
    template: IInsertTemplateParams;
    snapshot?: IInsertSnapshotParams | null;
  }) {
    if (params.template.ownerId) {
      this.invalidateByOwnerId(params.template.ownerId);
    }
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const template = reassureOwnerIdExists(params.template, ownerId);

    return this.db.transaction(async client => {
      const rows = await insertTemplate.run(template, client);
      if (params.snapshot) {
        await insertSnapshot.run(params.snapshot, client);
      }
      return rows[0];
    });
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
    this.getSnapshotsMetaByOwnerIdLoader.clear(ownerId);
  }

  public clearCache() {
    this.getTemplatesByOwnerIdLoader.clearAll();
    this.getSnapshotsMetaByOwnerIdLoader.clearAll();
  }
}
