import { AccountantModule } from '../generated-types/graphql';

export const resolvers: AccountantModule.Resolvers = {
  Charge: {
    accountantApproval: DbCharge => ({
      approved: DbCharge.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
  },
  CommonTransaction: {
    accountantApproval: DbTransaction => ({
      approved: DbTransaction.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
  },
  LedgerRecord: {
    accountantApproval: DbLedgerRecord => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
  },
};
