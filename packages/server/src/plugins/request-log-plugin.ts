import {
  getOperationAST,
  type ExecutionResult,
  type GraphQLError,
  type OperationDefinitionNode,
} from 'graphql';
import {
  finalAsyncIterator,
  handleStreamOrSingleExecutionResult,
  isAsyncIterable,
  type Plugin,
} from 'graphql-yoga';
import {
  INTERNAL_SERVER_ERROR,
  isOriginalGraphQLError,
  isUnexpectedGraphQLError,
} from '../observability/graphql-errors.js';
import {
  isGraphQLError,
  log,
  markLogged,
  serializeError,
  wasLogged,
} from '../observability/log.js';
import type { AccounterContext, RequestLogState } from '../shared/types/index.js';
import { correlationIdOf, requestIdOf } from './correlation-id-plugin.js';

/** `msg` of the one line written per GraphQL operation. */
export const OPERATION_LOG_MSG = 'graphql-operation';
/** `msg` of the line written per distinct error an operation returned. */
export const ERROR_LOG_MSG = 'graphql-error';

/** Paths listed on a `graphql-error` line when one error repeats across fields. */
const MAX_LOGGED_PATHS = 5;

/**
 * RequestLogPlugin — one structured line per GraphQL operation, plus one per error it returned.
 *
 * ```json
 * {"msg":"graphql-operation","level":"info","operationName":"ChargesScreen","operationType":"query",
 *  "durationMs":184,"errorCount":0,"errorCodes":[],"aborted":false,"userId":"…","businessId":"…",
 *  "requestId":"…","correlationId":null}
 * ```
 *
 * - Exactly one `graphql-operation` line per operation, including one rejected before execution
 *   (parse or validation errors, a failure while building the context). A streamed (`@defer`)
 *   result is logged when the stream ends, so `durationMs` covers all of it.
 * - Errors are logged as `graphql-error` lines **before** Yoga masks them, so the line has the real
 *   message (and, for an unexpected error, its stack and `cause` chain) together with the
 *   operation. "Unexpected" is `isUnexpectedGraphQLError`: masked by Yoga, or thrown on purpose with
 *   `INTERNAL_SERVER_ERROR`; those are logged at `error`, everything else at `warn`. Identical errors (same code and message) are logged once per operation with a
 *   `count`, so a missing token failing every guarded field is one line, not one per field. Each
 *   logged error is marked, and the Yoga logger skips it when Yoga logs it again as it masks it. An
 *   error whose cause a lower boundary already logged in full (`green-invoice-call-failed`) gets a
 *   `detailLogged: true` line without the stack: it still names the operation and request.
 * - Internal IDs only: `userId` and `businessId` are recorded by `AuthContextProvider` once auth
 *   resolves; never an email or a token. `requestId` is shared with the DB log lines (see
 *   `requestIdOf`).
 *
 * Register it before `useGraphQLModules`: its `onExecuteDone` must run before Yoga's error masking,
 * which Yoga always registers after the user's plugins.
 */
export function requestLogPlugin(): Plugin<AccounterContext> {
  return {
    onParams({ params, request, context }) {
      const state: RequestLogState = {
        startedAt: performance.now(),
        requestId: requestIdOf(request),
        correlationId: correlationIdOf(request),
        operationName: params.operationName ?? null,
        operationType: null,
        userId: null,
        businessId: null,
        executed: false,
        errorCount: 0,
        errorCodes: new Set(),
        logged: false,
      };
      // Yoga hands this same object to envelop as the operation's context, so `onExecute` and
      // `onExecutionResult` find the state on it.
      (context as Partial<AccounterContext>).requestLog = state;
    },
    onParse({ context }) {
      return ({ result }) => {
        const state = (context as Partial<AccounterContext>).requestLog;
        // Named here as well as in `onExecute`, so an operation rejected by validation or while
        // building the context is named too.
        if (state && result && !(result instanceof Error)) {
          nameOperation(state, getOperationAST(result, state.operationName));
        }
      };
    },
    onExecute({ args }) {
      const state = (args.contextValue as Partial<AccounterContext>).requestLog;
      if (!state) {
        return;
      }
      state.executed = true;
      nameOperation(state, getOperationAST(args.document, args.operationName), args.operationName);

      return {
        onExecuteDone(payload) {
          return handleStreamOrSingleExecutionResult(payload, ({ result }) => {
            recordExecutionErrors(state, result);
          });
        },
      };
    },
    onExecutionResult({ result, request, context, setResult }) {
      const state = (context as Partial<AccounterContext>).requestLog;
      if (!state) {
        return;
      }
      if (isAsyncIterable(result)) {
        setResult(finalAsyncIterator(result, () => writeOperationLine(state, request)));
        return;
      }
      if (!state.executed) {
        // Rejected before execution: parse, validation or context errors. Not logged one by one —
        // a validation error is the client's bug, and Yoga already logs an unexpected one.
        countErrors(state, result?.errors ?? []);
      }
      writeOperationLine(state, request);
    },
  };
}

function nameOperation(
  state: RequestLogState,
  operation: OperationDefinitionNode | null | undefined,
  requestedName?: string | null,
): void {
  state.operationName = operation?.name?.value ?? requestedName ?? state.operationName;
  state.operationType = operation?.operation ?? state.operationType;
}

function writeOperationLine(state: RequestLogState, request: Request): void {
  if (state.logged) {
    return;
  }
  state.logged = true;
  flushErrorGroups(state);
  log('info', OPERATION_LOG_MSG, {
    operationName: state.operationName,
    operationType: state.operationType,
    durationMs: Math.round(performance.now() - state.startedAt),
    errorCount: state.errorCount,
    errorCodes: [...state.errorCodes].sort(),
    aborted: request.signal?.aborted ?? false,
    userId: state.userId,
    businessId: state.businessId,
    requestId: state.requestId,
    correlationId: state.correlationId,
  });
}

/** Counts the errors on the operation line and adds their codes. Returns each error's code. */
function countErrors(
  state: RequestLogState,
  errors: readonly GraphQLError[],
): Array<{ error: GraphQLError; code: string | null; unexpected: boolean }> {
  state.errorCount += errors.length;
  return errors.map(error => {
    const unexpected = isUnexpectedGraphQLError(error);
    // A masked error is counted under the code Yoga gives it, so the line matches the response.
    const code = isOriginalGraphQLError(error) ? codeOf(error) : INTERNAL_SERVER_ERROR;
    if (code) {
      state.errorCodes.add(code);
    }
    return { error, code, unexpected };
  });
}

type ErrorGroup = {
  error: GraphQLError;
  code: string | null;
  unexpected: boolean;
  /** A boundary below already logged this error in full (e.g. `green-invoice-call-failed`). */
  detailLogged: boolean;
  count: number;
  paths: string[];
};

// An operation's error groups, kept until it ends so identical errors across `@defer` chunks share
// one line. Weak, so an operation that never ends holds nothing alive.
const errorGroups = new WeakMap<RequestLogState, Map<string, ErrorGroup>>();

/**
 * Counts and groups an execution result's errors. Each is marked as logged right away, before Yoga
 * masks it; the lines themselves are written when the operation ends (`flushErrorGroups`).
 */
function recordExecutionErrors(state: RequestLogState, result: ExecutionResult): void {
  const errors = errorsOf(result);
  if (!errors.length) {
    return;
  }

  let groups = errorGroups.get(state);
  if (!groups) {
    groups = new Map();
    errorGroups.set(state, groups);
  }
  for (const { error, code, unexpected } of countErrors(state, errors)) {
    markLogged(error);
    const key = `${code ?? ''}\u0000${error.message}`;
    let group = groups.get(key);
    if (!group) {
      group = { error, code, unexpected, detailLogged: chainWasLogged(error), count: 0, paths: [] };
      groups.set(key, group);
    }
    group.count += 1;
    if (error.path && group.paths.length < MAX_LOGGED_PATHS) {
      group.paths.push(error.path.join('.'));
    }
  }
}

function flushErrorGroups(state: RequestLogState): void {
  const groups = errorGroups.get(state);
  errorGroups.delete(state);
  for (const group of groups?.values() ?? []) {
    log(group.unexpected ? 'error' : 'warn', ERROR_LOG_MSG, {
      operationName: state.operationName,
      message: group.error.message,
      code: group.code,
      path: group.paths[0] ?? null,
      ...(group.count > 1 ? { count: group.count, paths: group.paths } : {}),
      // The stack and `cause` chain only for a server fault (an expected error's stack is noise),
      // and only once: an error a lower boundary logged in full gets a reference line instead.
      ...(group.detailLogged
        ? { detailLogged: true }
        : group.unexpected
          ? { error: serializeError(group.error.originalError ?? group.error) }
          : {}),
      userId: state.userId,
      businessId: state.businessId,
      requestId: state.requestId,
    });
  }
}

/** Whether an error below this one (its `originalError` / `cause` chain) was already logged. */
function chainWasLogged(error: GraphQLError): boolean {
  let current: unknown = error.originalError;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (wasLogged(current)) {
      return true;
    }
    current = isGraphQLError(current)
      ? (current.originalError ?? current.cause)
      : (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Errors of a single result or of one chunk of a streamed (`@defer` / `@stream`) result. */
function errorsOf(result: ExecutionResult): GraphQLError[] {
  const errors = [...(result.errors ?? [])];
  const incremental = (result as { incremental?: Array<{ errors?: readonly GraphQLError[] }> })
    .incremental;
  for (const part of incremental ?? []) {
    errors.push(...(part.errors ?? []));
  }
  return errors;
}

function codeOf(error: GraphQLError): string | null {
  const code = error.extensions?.['code'];
  return typeof code === 'string' ? code : null;
}
