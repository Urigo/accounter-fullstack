import { HashavshevetModule } from '../generated-types/graphql';

export const resolvers: HashavshevetModule.Resolvers = {
  CommonTransaction: {
    hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id,
  },
  LedgerRecord: {
    hashavshevetId: DbLedgerRecord => DbLedgerRecord.hashavshevet_id,
  },
};
