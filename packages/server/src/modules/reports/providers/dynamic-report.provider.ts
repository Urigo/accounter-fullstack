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
  IGetLatestComparableSnapshotParams,
  IGetLatestComparableSnapshotQuery,
  IGetLatestComparableSnapshotResult,
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
  ILockTemplateForSnapshotQuery,
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

// created_at is the insert's wall-clock time, not the column default (the transaction's start).
// A request's transaction can start long before it waits on the template row lock, so the
// default could order a snapshot before the very row it was stamped against — and "newest
// comparable" would then pick the wrong baseline.
const insertSnapshot = sql<IInsertSnapshotQuery>`
  INSERT INTO accounter_schema.dynamic_report_template_snapshots
    (owner_id, template_name, from_date, to_date, scope_owner_id, tree, leaf_values,
     leaf_fingerprints, leaf_approvals, created_by, created_at)
  VALUES ($ownerId, $templateName, $fromDate, $toDate, $scopeOwnerId, $tree, $leafValues,
          $leafFingerprints, $leafApprovals, $createdBy, clock_timestamp())
  RETURNING *;`;

// Deliberately omits the jsonb payload columns (tree, leaf_values, leaf_fingerprints,
// leaf_approvals): this feeds the snapshot picker, which needs only identity and dates, and those
// columns are the whole weight of a row. The payload is fetched by id once a baseline is chosen.
const getSnapshotsMetaByOwnerIds = sql<IGetSnapshotsMetaByOwnerIdsQuery>`
  SELECT id, owner_id, template_name, from_date, to_date, scope_owner_id, created_by, created_at
  FROM accounter_schema.dynamic_report_template_snapshots
  WHERE owner_id IN $$ownerIds
  ORDER BY created_at DESC;`;

const getSnapshotById = sql<IGetSnapshotByIdQuery>`
  SELECT *
  FROM accounter_schema.dynamic_report_template_snapshots
  WHERE id = $id;`;

// Backed by dynamic_report_template_snapshots_comparable_index. "Comparable" means the same
// template, period and scope: the only snapshots whose approvals describe the same report lines.
// Stamping reads only the approvals and fingerprints, so the heavy tree and leaf_values payloads
// are left out: this runs inside the write transaction, while the template row lock is held.
const getLatestComparableSnapshot = sql<IGetLatestComparableSnapshotQuery>`
  SELECT id, created_at, leaf_fingerprints, leaf_approvals
  FROM accounter_schema.dynamic_report_template_snapshots
  WHERE owner_id = $ownerId!
    AND template_name = $templateName!
    AND from_date = $fromDate!
    AND to_date = $toDate!
    AND scope_owner_id = $scopeOwnerId!
  ORDER BY created_at DESC
  LIMIT 1;`;

// Takes the same row lock an UPDATE of the template takes, without writing it. A capture holds it
// for its whole transaction, so it serializes with concurrent saves and captures of the template:
// each one reads the previous comparable snapshot only after the one before it has committed.
const lockTemplateForSnapshot = sql<ILockTemplateForSnapshotQuery>`
  SELECT *
  FROM accounter_schema.dynamic_report_templates
  WHERE name = $name! AND owner_id = $ownerId!
  FOR NO KEY UPDATE;`;

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

/** The client `TenantAwareDBClient.transaction` hands its callback. */
type TransactionClient = Parameters<Parameters<TenantAwareDBClient['transaction']>[0]>[0];

/** Identifies which snapshots are comparable: same template, period and scope. */
export type ComparableSnapshotKey = {
  ownerId: string;
  templateName: string;
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
};

export type SnapshotWriteParams = {
  key: ComparableSnapshotKey;
  /**
   * Builds the row to insert from the previous comparable snapshot (null when there is none). Runs
   * inside the write transaction; throwing aborts the whole save.
   */
  buildSnapshot: (previous: IGetLatestComparableSnapshotResult | null) => IInsertSnapshotParams;
};

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
   * The newest snapshot with the same template, period and scope, or null when there is none.
   * Pass the transaction's client to read it inside the transaction that writes the next one.
   */
  public async getLatestComparableSnapshot(
    params: IGetLatestComparableSnapshotParams,
    client?: TransactionClient,
  ): Promise<IGetLatestComparableSnapshotResult | null> {
    const [snapshot] = await getLatestComparableSnapshot.run(params, client ?? this.db);
    return snapshot ?? null;
  }

  /**
   * Looks up the previous comparable snapshot and inserts the one built from it, on the given
   * transaction client. The caller must already hold the template's row lock, so the row read here
   * is the one this insert actually follows.
   */
  private async insertStampedSnapshot(client: TransactionClient, snapshot: SnapshotWriteParams) {
    const previous = await this.getLatestComparableSnapshot(snapshot.key, client);
    const [inserted] = await insertSnapshot.run(snapshot.buildSnapshot(previous), client);
    return inserted;
  }

  /**
   * Saves a template and the baseline captured with it as one unit.
   *
   * The whole premise of change tracking is that a snapshot exists for every save. Writing the two
   * separately would let the template land while the snapshot fails, leaving a save with no
   * baseline and the next visit silently diffing against an older one — so they share a
   * transaction and the save is all-or-nothing.
   *
   * The snapshot is built by a callback that receives the previous comparable snapshot, read inside
   * the same transaction after the template UPDATE has taken its row lock. A concurrent save of
   * the same template waits on that lock, so each save stamps its approvals against the row it
   * actually follows.
   */
  public async updateTemplateWithSnapshot(params: {
    template: IUpdateTemplateParams;
    snapshot?: SnapshotWriteParams | null;
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
        await this.insertStampedSnapshot(client, params.snapshot);
      }
      return rows[0];
    });
  }

  /**
   * Records a baseline without writing the template row, so it is allowed on a locked template.
   * Same transactional shape as `updateTemplateWithSnapshot`: the template row is locked (not
   * written) first, then the previous comparable snapshot is read and the new one inserted.
   * Resolves to the template row, or undefined when the template does not exist.
   */
  public async captureSnapshot(params: SnapshotWriteParams) {
    const { ownerId, templateName } = params.key;
    this.invalidateByOwnerId(ownerId);

    return this.db.transaction(async client => {
      const [template] = await lockTemplateForSnapshot.run({ name: templateName, ownerId }, client);
      if (!template) {
        return undefined;
      }
      await this.insertStampedSnapshot(client, params);
      return template;
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
