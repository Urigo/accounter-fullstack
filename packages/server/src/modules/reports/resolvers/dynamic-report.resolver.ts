import type { DynamicReportNode } from '../../../__generated__/types.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AnnualAuditProvider } from '../../annual-audit/providers/annual-audit.provider.js';
import {
  isLegacyTemplate,
  migrateLegacyTemplate,
  parseTemplate,
  validateTemplate,
} from '../helpers/dynamic-report.helper.js';
import { DynamicReportProvider } from '../providers/dynamic-report.provider.js';
import type { ReportsModule } from '../types.js';

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
  },
  Mutation: {
    updateDynamicReportTemplate: async (_, { name, template }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        validateTemplate(template);

        return injector
          .get(DynamicReportProvider)
          .updateTemplate({
            name,
            ownerId,
            template,
          })
          .then(result => {
            if (result.length === 0) {
              throw new Error(`Report template "${name}" not found`);
            }
            return result[0];
          });
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
    insertDynamicReportTemplate: async (_, { name, template }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        validateTemplate(template);

        return injector
          .get(DynamicReportProvider)
          .insertTemplate({
            name,
            ownerId,
            template,
          })
          .then(result => {
            return result[0];
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
  DynamicReportInfo: {
    id: report => `${report.owner_id}-${report.name}`,
    name: report => report.name,
    created: report => report.created_at,
    updated: report => report.updated_at,
    isLocked: report => report.is_locked ?? false,
    template: report => {
      try {
        return parseTemplate(report.template) as DynamicReportNode[];
      } catch (error) {
        // Legacy template: attempt in-place migration before returning
        try {
          const raw: unknown[] = JSON.parse(report.template);
          if (isLegacyTemplate(raw)) {
            const migrated = migrateLegacyTemplate(
              raw as Parameters<typeof migrateLegacyTemplate>[0],
              new Map(),
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
