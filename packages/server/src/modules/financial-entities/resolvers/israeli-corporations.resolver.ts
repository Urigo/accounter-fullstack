import { IsraeliCorporationsRegistryClient } from '../../app-providers/israeli-corporations-registry.js';
import type { FinancialEntitiesModule } from '../types.js';

export const israeliCorporationsResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    israeliCorporation: async (_, { corporationNumber }, { injector }) =>
      injector.get(IsraeliCorporationsRegistryClient).getCorporationByNumber(corporationNumber),
  },
};
