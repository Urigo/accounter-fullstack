import type { AuthModule } from '../types.js';
import { TeamProvider } from '../providers/team.provider.js';

export const teamResolvers: AuthModule.Resolvers = {
  Query: {
    listTeamMembers: async (_, __, { injector }) => {
      return injector.get(TeamProvider).listTeamMembers();
    },
    listPendingInvitations: async (_, __, { injector }) => {
      return injector.get(TeamProvider).listPendingInvitations();
    },
  },
  Mutation: {
    removeTeamMember: async (_, { userId }, { injector }) => {
      return injector.get(TeamProvider).removeTeamMember(userId);
    },
    revokeInvitation: async (_, { invitationId }, { injector }) => {
      return injector.get(TeamProvider).revokeInvitation(invitationId);
    },
    updateTeamMemberRole: async (_, { userId, roleId }, { injector }) => {
      return injector.get(TeamProvider).updateTeamMemberRole(userId, roleId);
    },
  },
};
