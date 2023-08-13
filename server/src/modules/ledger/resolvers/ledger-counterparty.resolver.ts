import type { ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';

export const ledgerCounterparty: ResolverFn<
  ResolversTypes['LedgerCounterparty'],
  ResolversParentTypes['LedgerRecord'],
  GraphQLModules.Context,
  { account: 'CreditAccount1' | 'CreditAccount2' | 'DebitAccount1' | 'DebitAccount2' }
> = (DbLedgerRecord, { account }) => {
  let counterpartyProto = undefined;
  switch (account) {
    case 'CreditAccount1':
      counterpartyProto = DbLedgerRecord.creditAccountID1;
      break;
    case 'CreditAccount2':
      counterpartyProto = DbLedgerRecord.creditAccountID2;
      break;
    case 'DebitAccount1':
      counterpartyProto = DbLedgerRecord.debitAccountID1;
      break;
    case 'DebitAccount2':
      counterpartyProto = DbLedgerRecord.debitAccountID2;
      break;
  }

  return counterpartyProto ?? null;
};
