import type { DynamicReportNode } from '../../../__generated__/types.js';
import { errorSimplifier } from '../../../shared/errors.js';
import {
  dateToTimelessDateString,
  optionalDateToTimelessDateString,
} from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AnnualAuditProvider } from '../../annual-audit/providers/annual-audit.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import {
  isLegacyTemplate,
  migrateLegacyTemplate,
  parseSnapshotTree,
  parseTemplate,
  recordToSnapshotValues,
  snapshotValuesToRecord,
  validateSnapshotInput,
  validateTemplate,
  type DynamicReportSnapshotInputType,
} from '../helpers/dynamic-report.helper.js';
import { DynamicReportProvider } from '../providers/dynamic-report.provider.js';
import type { ReportsModule } from '../types.js';

/**
 * Shapes the baseline row a later diff is measured against: the tree exactly as it was saved, and
 * the figures the client had on screen at that moment. The row is handed to the provider so it can
 * be written inside the same transaction as the template — snapshot ≡ save, and a save that lands
 * without its snapshot would leave the next visit diffing against an older baseline.
 */
function toSnapshotRow(
  ownerId: string,
  templateName: string,
  template: string,
  snapshot: DynamicReportSnapshotInputType,
) {
  return {
    ownerId,
    templateName,
    fromDate: snapshot.fromDate,
    toDate: snapshot.toDate,
    scopeOwnerId: snapshot.scopeOwnerId,
    tree: template,
    leafValues: JSON.stringify(snapshotValuesToRecord(snapshot.values)),
    createdBy: null,
  };
}

export const dynamicReportResolver: ReportsModule.Resolvers = {
  Query: {
    dynamicReport: async (_, { name }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        return injector.get(DynamicReportProvider).getTemplate({
          name,
          ownerId,
        });
      } catch (error) {
        throw errorSimplifier(`Failed to get dynamic report template "${name}"`, error);
      }
    },
    allDynamicReports: async (_, __, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        return injector.get(DynamicReportProvider).getTemplatesByOwnerIdLoader.load(ownerId);
      } catch (error) {
        throw errorSimplifier('Failed to get all dynamic report templates', error);
      }
    },
    dynamicReportSnapshot: async (_, { id }, { injector }) => {
      try {
        // RLS scopes the row to the caller's businesses, so an id from another tenant simply
        // returns nothing rather than leaking.
        return (await injector.get(DynamicReportProvider).getSnapshotById({ id })) ?? null;
      } catch (error) {
        throw errorSimplifier(`Failed to get dynamic report snapshot "${id}"`, error);
      }
    },
  },
  Mutation: {
    updateDynamicReportTemplate: async (_, { name, template, snapshot }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        validateTemplate(template);
        const validatedSnapshot = snapshot ? validateSnapshotInput(snapshot) : null;

        const result = await injector.get(DynamicReportProvider).updateTemplateWithSnapshot({
          template: {
            name,
            ownerId,
            template,
            fromDate: validatedSnapshot?.fromDate ?? null,
            toDate: validatedSnapshot?.toDate ?? null,
          },
          snapshot: validatedSnapshot
            ? toSnapshotRow(ownerId, name, template, validatedSnapshot)
            : null,
        });
        if (!result) {
          throw new Error(`Report template "${name}" not found`);
        }

        return result;
      } catch (error) {
        throw errorSimplifier(`Failed to update dynamic report template "${name}"`, error);
      }
    },
    updateDynamicReportTemplateName: async (_, { name, newName }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        return injector
          .get(DynamicReportProvider)
          .updateTemplateName({
            prevName: name,
            newName,
            ownerId,
          })
          .then(result => {
            if (result.length === 0) {
              throw new Error(`Report template "${name}" not found`);
            }
            return result[0];
          });
      } catch (error) {
        throw errorSimplifier(`Failed to update dynamic report template name "${name}"`, error);
      }
    },
    insertDynamicReportTemplate: async (_, { name, template, snapshot }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        validateTemplate(template);
        const validatedSnapshot = snapshot ? validateSnapshotInput(snapshot) : null;

        return injector.get(DynamicReportProvider).insertTemplateWithSnapshot({
          template: {
            name,
            ownerId,
            template,
            fromDate: validatedSnapshot?.fromDate ?? null,
            toDate: validatedSnapshot?.toDate ?? null,
          },
          snapshot: validatedSnapshot
            ? toSnapshotRow(ownerId, name, template, validatedSnapshot)
            : null,
        });
      } catch (error) {
        throw errorSimplifier(`Failed to insert dynamic report template "${name}"`, error);
      }
    },
    deleteDynamicReportTemplate: async (_, { name }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        return injector
          .get(DynamicReportProvider)
          .deleteTemplate({
            name,
            ownerId,
          })
          .then(result => {
            if (result.length === 0) {
              throw new Error(`Report template "${name}" not found`);
            }
            return result[0].name;
          });
      } catch (error) {
        throw errorSimplifier(`Failed to delete dynamic report template "${name}"`, error);
      }
    },
    lockDynamicReportTemplate: async (_, { name }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        return injector.get(DynamicReportProvider).lockTemplate({ name, ownerId });
      } catch (error) {
        throw errorSimplifier(`Failed to lock dynamic report template "${name}"`, error);
      }
    },
    unlockDynamicReportTemplate: async (_, { name }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        const result = await injector.get(DynamicReportProvider).unlockTemplate({ name, ownerId });

        // Auto-reset Step 09 status for all years that referenced this template
        await injector.get(AnnualAuditProvider).resetStep09ForTemplate(ownerId, name);

        return result;
      } catch (error) {
        throw errorSimplifier(`Failed to unlock dynamic report template "${name}"`, error);
      }
    },
  },
  DynamicReportSnapshotMeta: {
    id: snapshot => snapshot.id,
    createdAt: snapshot => snapshot.created_at,
    createdBy: snapshot => snapshot.created_by,
    fromDate: snapshot => dateToTimelessDateString(snapshot.from_date),
    toDate: snapshot => dateToTimelessDateString(snapshot.to_date),
  },
  DynamicReportSnapshot: {
    id: snapshot => snapshot.id,
    createdAt: snapshot => snapshot.created_at,
    createdBy: snapshot => snapshot.created_by,
    fromDate: snapshot => dateToTimelessDateString(snapshot.from_date),
    toDate: snapshot => dateToTimelessDateString(snapshot.to_date),
    scopeOwnerId: snapshot => snapshot.scope_owner_id,
    tree: snapshot => parseSnapshotTree(snapshot.tree) as DynamicReportNode[],
    values: snapshot => recordToSnapshotValues(snapshot.leaf_values),
  },
  DynamicReportInfo: {
    id: report => `${report.owner_id}-${report.name}`,
    name: report => report.name,
    created: report => report.created_at,
    updated: report => report.updated_at,
    isLocked: report => report.is_locked ?? false,
    fromDate: report => optionalDateToTimelessDateString(report.from_date),
    toDate: report => optionalDateToTimelessDateString(report.to_date),
    snapshots: async (report, _args, { injector }) => {
      const snapshots = await injector
        .get(DynamicReportProvider)
        .getSnapshotsMetaByOwnerIdLoader.load(report.owner_id);
      // Batched per owner, so narrow to this template. Already ordered newest first by the query.
      return snapshots.filter(snapshot => snapshot.template_name === report.name);
    },
    template: async (report, _args, { injector }) => {
      try {
        return parseTemplate(report.template) as DynamicReportNode[];
      } catch (error) {
        // Legacy template: attempt in-place migration before returning
        try {
          const raw: unknown[] = JSON.parse(report.template);
          if (isLegacyTemplate(raw)) {
            const entityBySortCode = await injector
              .get(FinancialEntitiesProvider)
              .getEntityBySortCodeMap();
            const migrated = migrateLegacyTemplate(
              raw as Parameters<typeof migrateLegacyTemplate>[0],
              entityBySortCode,
            );
            return migrated as DynamicReportNode[];
          }
        } catch {
          // fall through to the original error
        }
        throw errorSimplifier(`Failed to parse template for report ${report.name}`, error);
      }
    },
  },
};
