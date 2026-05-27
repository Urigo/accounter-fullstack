import iconv from 'iconv-lite';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { AdminOnboardingProvider } from '../providers/admin-onboarding.provider.js';
import { ShaamImportProvider } from '../providers/shaam-import.provider.js';
import type { OnboardingModule } from '../types.js';

async function decodeWindows1255(file: File | Blob): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return iconv.decode(buffer, 'windows-1255');
}

export const onboardingResolvers: OnboardingModule.Resolvers = {
  Mutation: {
    bootstrapNewClient: async (_parent, { input }, { injector }) => {
      const { business, invitationToken, adminContext } = await injector
        .get(AdminOnboardingProvider)
        .bootstrapNewClient(input);

      return { id: business.id, business, invitationToken, adminContext };
    },

    importShaamFile: async (_parent, { bkmvdata, ini, ownerId }, { injector }) => {
      // Validate owner against the write scope (throws if out of scope)
      await injector.get(ScopeProvider).resolveWriteTarget(ownerId);

      const bkmvdataContent = await decodeWindows1255(bkmvdata as File | Blob);
      const iniContent = ini ? await decodeWindows1255(ini as File | Blob) : null;

      return injector
        .get(ShaamImportProvider)
        .importShaamFile(ownerId, bkmvdataContent, iniContent);
    },
  },
};
