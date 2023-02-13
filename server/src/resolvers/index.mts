import { Resolvers } from '../__generated__/types.mjs';
import { businessesResolvers } from './businesses/index.mjs';
import { chargesResolvers } from './charges/index.mjs';
import { documentsResolvers } from './documents/index.mjs';
import { financialAccountsResolvers } from './financial-accounts/index.mjs';
import { financialEntitiesResolvers } from './financial-entities/index.mjs';
import { hashavshevetResolvers } from './hashavshevet/index.mjs';
import { ledgerResolvers } from './ledger/index.mjs';
import { reportsResolvers } from './reports/index.mjs';

export const resolvers: Resolvers = {
  ...reportsResolvers,
  ...documentsResolvers,
  ...financialEntitiesResolvers,
  ...financialAccountsResolvers,
  ...chargesResolvers,
  ...ledgerResolvers,
  ...businessesResolvers,
  ...hashavshevetResolvers,
  Query: {
    ...reportsResolvers.Query,
    ...documentsResolvers.Query,
    ...financialEntitiesResolvers.Query,
    ...chargesResolvers.Query,
    ...businessesResolvers.Query,
    ...hashavshevetResolvers.Query,
  },
  Mutation: {
    ...documentsResolvers.Mutation,
    ...chargesResolvers.Mutation,
    ...ledgerResolvers.Mutation,
  },
};
