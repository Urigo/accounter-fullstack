import { GraphQLError } from 'graphql';
import type { ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';

export const businessTransactionCounterparty: ResolverFn<
  ResolversTypes['BusinessTransactionCounterparty'],
  ResolversParentTypes['BusinessTransaction'],
  GraphQLModules.Context,
  object
> = DbLedgerRecord => {
  if (typeof DbLedgerRecord.counterAccount === 'string') {
    return DbLedgerRecord.counterAccount;
  }
  if (typeof DbLedgerRecord.counterAccount === 'object') {
    return {
      __typename: 'TaxCategory',
      id: DbLedgerRecord.counterAccount.id,
      name: DbLedgerRecord.counterAccount.name,
    };
  }
  throw new GraphQLError(`Invalid counterpartyProto type: ${DbLedgerRecord.counterAccount}`);
};
