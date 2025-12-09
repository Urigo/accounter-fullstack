import { GraphQLError } from 'graphql';
import { DynamicReportNode } from '../../../__generated__/types.js';
import { parseTemplate, validateTemplate } from '../helpers/dynamic-report.helper.js';
import { DynamicReportProvider } from '../providers/dynamic-report.provider.js';
import type { ReportsModule } from '../types.js';

export const dynamicReportResolver: ReportsModule.Resolvers = {
  Query: {
    dynamicReport: async (_, { name }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        return injector.get(DynamicReportProvider).getTemplate({
          name,
          ownerId: defaultAdminBusinessId,
        });
      } catch (error) {
        const message = `Failed to get dynamic report template "${name}"`;
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    allDynamicReports: async (_, __, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        return injector
          .get(DynamicReportProvider)
          .getTemplatesByOwnerIdLoader.load(defaultAdminBusinessId);
      } catch (error) {
        const message = 'Failed to get all dynamic report templates';
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
  },
  Mutation: {
    updateDynamicReportTemplate: async (_, { name, template }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        validateTemplate(template);

        return injector
          .get(DynamicReportProvider)
          .updateTemplate({
            name,
            ownerId: defaultAdminBusinessId,
            template,
          })
          .then(result => {
            if (result.length === 0) {
              throw new Error(`Report template "${name}" not found`);
            }
            return result[0];
          });
      } catch (error) {
        const message = `Failed to update dynamic report template "${name}"`;
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    updateDynamicReportTemplateName: async (_, { name, newName }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        return injector
          .get(DynamicReportProvider)
          .updateTemplateName({
            prevName: name,
            newName,
            ownerId: defaultAdminBusinessId,
          })
          .then(result => {
            if (result.length === 0) {
              throw new Error(`Report template "${name}" not found`);
            }
            return result[0];
          });
      } catch (error) {
        const message = `Failed to update dynamic report template name "${name}"`;
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    insertDynamicReportTemplate: async (_, { name, template }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        validateTemplate(template);

        return injector
          .get(DynamicReportProvider)
          .insertTemplate({
            name,
            ownerId: defaultAdminBusinessId,
            template,
          })
          .then(result => {
            return result[0];
          });
      } catch (error) {
        const message = `Failed to insert dynamic report template "${name}"`;
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
    deleteDynamicReportTemplate: async (_, { name }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        return injector
          .get(DynamicReportProvider)
          .deleteTemplate({
            name,
            ownerId: defaultAdminBusinessId,
          })
          .then(result => {
            if (result.length === 0) {
              throw new Error(`Report template "${name}" not found`);
            }
            return result[0].name;
          });
      } catch (error) {
        const message = `Failed to delete dynamic report template "${name}"`;
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
  },
  DynamicReportInfo: {
    id: report => `${report.owner_id}-${report.name}`,
    name: report => report.name,
    created: report => report.created_at,
    updated: report => report.updated_at,
    template: report => {
      try {
        return parseTemplate(report.template) as DynamicReportNode[];
      } catch (error) {
        const message = `Failed to parse template for report ${report.name}`;
        console.log(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
  },
};
