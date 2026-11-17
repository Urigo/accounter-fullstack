import type { Resolvers, ResolversTypes } from '../../../__generated__/types.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { runManualAutomations } from '../helpers/run-manual-automations.helper.js';
import type { ManualAutomationsModule } from '../types.js';

export const manualAutomationsResolvers: ManualAutomationsModule.Resolvers &
  Pick<Resolvers, 'ManualAutomationEvent'> = {
  Mutation: {
    runManualAutomations: async (_, __, { injector }) => {
      const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      return {
        // An async iterable list, so the client can @stream the events as they happen
        events: runManualAutomations(
          injector,
          ownerId,
        ) as unknown as readonly ResolversTypes['ManualAutomationEvent'][],
      };
    },
  },
  ManualAutomationEvent: {
    __resolveType: parent => parent.__typename!,
  },
};
