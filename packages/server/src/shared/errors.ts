import { GraphQLError } from 'graphql';

export class LedgerLockError extends GraphQLError {
  constructor(message = 'Cannot adjust locked ledger records') {
    super(message, {
      extensions: {
        code: 'LEDGER_LOCK_ERROR',
      },
    });
  }
}

export function errorSimplifier(message: string, error: unknown): GraphQLError {
  console.error(`${message}:`, error);
  if (error instanceof GraphQLError) {
    return error;
  }
  return new GraphQLError(message);
}
