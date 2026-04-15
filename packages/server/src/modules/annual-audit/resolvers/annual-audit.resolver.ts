import { errorSimplifier } from '../../../shared/errors.js';
import { AnnualAuditProvider } from '../providers/annual-audit.provider.js';
import type { AnnualAuditModule } from '../types.js';

export const annualAuditResolvers: AnnualAuditModule.Resolvers = {
  Query: {
    annualAuditOpeningBalanceStatus: async (_, { ownerId, year }, { injector }) => {
      try {
        return await injector.get(AnnualAuditProvider).getOpeningBalanceStatus(ownerId, year);
      } catch (error) {
        throw errorSimplifier(
          `Failed to get annual audit opening balance status for owner ${ownerId}, year ${year}`,
          error,
        );
      }
    },
    annualAuditStepStatuses: async (_, { ownerId, year }, { injector }) => {
      try {
        return await injector.get(AnnualAuditProvider).getStepStatuses(ownerId, year);
      } catch (error) {
        throw errorSimplifier(
          `Failed to get annual audit step statuses for owner ${ownerId}, year ${year}`,
          error,
        );
      }
    },
  },
  Mutation: {
    setAnnualAuditStep03Status: async (_, { input }, { injector }) => {
      try {
        return await injector.get(AnnualAuditProvider).upsertStepStatus({
          ownerId: input.ownerId,
          year: input.year,
          stepId: '3',
          status: input.status,
          notes: input.notes,
        });
      } catch (error) {
        throw errorSimplifier(
          `Failed to set annual audit step 03 status for owner ${input.ownerId}, year ${input.year}`,
          error,
        );
      }
    },
    setAnnualAuditStep09Status: async (_, { input }, { injector }) => {
      try {
        return await injector.get(AnnualAuditProvider).setStep09Status({
          ownerId: input.ownerId,
          year: input.year,
          templateName: input.templateName,
        });
      } catch (error) {
        throw errorSimplifier(
          `Failed to set annual audit step 09 status for owner ${input.ownerId}, year ${input.year}`,
          error,
        );
      }
    },
  },
  AnnualAuditStepStatusInfo: {
    evidence: stepStatus => stepStatus.evidence ?? null,
  },
};
