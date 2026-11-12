import type { GraphQLError } from 'graphql';
import { isGraphQLError } from './log.js';

/** The code Yoga gives an error it masks, and the one a resolver uses to report a server fault. */
export const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR';

/**
 * An error a resolver threw on purpose as a `GraphQLError`, which Yoga passes through to the client;
 * anything else is masked as `Unexpected error.` Mirrors Yoga's own check.
 */
export function isOriginalGraphQLError(error: unknown): boolean {
  if (!isGraphQLError(error)) {
    return false;
  }
  return error.originalError == null || isOriginalGraphQLError(error.originalError);
}

/**
 * Whether a GraphQL error is a server fault rather than an expected outcome (`FORBIDDEN`,
 * `NOT_FOUND`, a validation message for the user): Yoga masks it, or it was thrown on purpose with
 * `extensions.code: 'INTERNAL_SERVER_ERROR'`.
 *
 * The one predicate for "someone should look at this": it decides the `error` level and the stack on
 * a `graphql-error` line, and is what an alert must use too, so the two can't drift apart.
 */
export function isUnexpectedGraphQLError(error: GraphQLError): boolean {
  return !isOriginalGraphQLError(error) || error.extensions?.['code'] === INTERNAL_SERVER_ERROR;
}
