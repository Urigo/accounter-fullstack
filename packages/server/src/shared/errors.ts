import { GraphQLError } from 'graphql';

export class LedgerLockError extends GraphQLError {
  constructor() {
    super('Cannot adjust locked ledger records', {
      extensions: {
        code: 'LEDGER_LOCK_ERROR',
      },
    });
  }
}
