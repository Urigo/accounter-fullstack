import { useCallback, useRef, type ReactNode } from 'react';
import { toast, type ExternalToast } from 'sonner';
import { useMutation, type AnyVariables, type CombinedError, type TypedDocumentNode } from 'urql';
import { handleCommonErrors, type NonCommonError } from '../helpers/error-handling.js';

/** A constant, or a value derived from the mutation variables. */
type FromVariables<TVariables, TValue> = TValue | ((variables: TVariables) => TValue);

/** A constant, or a value derived from the mutation's result and the variables it ran with. */
type FromResult<TResult, TVariables, TValue> =
  TValue | ((result: TResult, variables: TVariables) => TValue);

function resolve<TArgs extends unknown[], TValue>(
  value: TValue | ((...args: TArgs) => TValue),
  ...args: TArgs
): TValue {
  return typeof value === 'function' ? (value as (...args: TArgs) => TValue)(...args) : value;
}

/** Success notification options. `title` is the toast heading; the rest is passed to sonner. */
export type SuccessToast = ExternalToast & {
  /** Toast heading. Defaults to `'Success'`. */
  title?: string;
};

/** Error notification defaults: long-lived and dismissible, so a failure is never missed. */
const ERROR_TOAST_DEFAULTS = {
  duration: 100_000,
  closeButton: true,
} as const satisfies ExternalToast;

export type UseApiMutationOptions<
  TData extends object,
  TVariables extends AnyVariables,
  TKey extends keyof TData | undefined,
  TResult,
> = {
  /** The generated mutation document, e.g. `AddTagDocument`. */
  document: TypedDocumentNode<TData, TVariables>;
  /**
   * Sonner toast id, so the loading toast is replaced in place by the success or error one.
   * Derive it from the variables to let concurrent calls of the same mutation notify separately.
   */
  notificationId: FromVariables<TVariables, string>;
  /** Heading of the toast shown while the mutation is in flight, e.g. `'Adding tag'`. */
  loadingMessage: FromVariables<TVariables, string>;
  /** Description of the error toast, and the prefix of the logged error. */
  errorMessage: FromVariables<TVariables, string>;
  /**
   * Field of the mutation result that may hold a `CommonError`. When set, a `CommonError`
   * response is reported as an error and excluded from the type handed to `select`.
   */
  commonErrorPath?: TKey;
  /**
   * Narrows the raw mutation data down to what callers of the hook need — usually the single
   * field of the mutation. Defaults to returning the data unchanged.
   *
   * It runs inside the hook's `try`, so throwing from it rejects a response the server reported
   * as unsuccessful, turning it into the hook's error notification.
   */
  select?: (data: NonCommonError<TData, TKey>, variables: TVariables) => TResult;
  /** Success notification, or `false` to show none. Defaults to a plain `'Success'` toast. */
  successToast?: FromResult<TResult, TVariables, SuccessToast | false>;
  /**
   * Side effects to run once the mutation succeeded and its toast was shown — refreshing a
   * cache, for instance. Use `select` instead to shape what `execute` resolves to.
   */
  onSuccess?: (result: TResult, variables: TVariables) => void;
  /** Overrides for the error notification, on top of {@link ERROR_TOAST_DEFAULTS}. */
  errorToast?: ExternalToast;
  /**
   * Description of the error notification. Receives whatever was thrown, so a hook can surface a
   * server-provided reason instead of its generic message. Defaults to `errorMessage`.
   */
  errorDescription?: (error: unknown, variables: TVariables) => ReactNode;
};

export type UseApiMutation<TVariables extends AnyVariables, TResult> = {
  fetching: boolean;
  error: CombinedError | undefined;
  /** Runs the mutation. Resolves to the selected result, or to `undefined` on failure. */
  execute: (variables: TVariables) => Promise<TResult | void>;
};

/**
 * Runs a GraphQL mutation with the notification and error handling every mutation hook in this
 * package shares: a loading toast while in flight, `handleCommonErrors` on the response, a
 * success toast, and an error toast plus a console entry when anything throws.
 *
 * Mutation hooks wrap this and re-expose `execute` under a domain name, so components keep
 * consuming a purpose-named hook:
 *
 * ```ts
 * export const useAddTag = (): UseAddTag => {
 *   const { fetching, execute } = useApiMutation({
 *     document: AddTagDocument,
 *     notificationId: variables => `addTag-${variables.tagName}`,
 *     loadingMessage: 'Adding tag',
 *     errorMessage: variables => `Error adding new tag [${variables.tagName}]`,
 *     successToast: (_, variables) => ({
 *       description: `"${variables.tagName}" tag was successfully added`,
 *     }),
 *   });
 *
 *   return { fetching, addTag: execute };
 * };
 * ```
 *
 * `execute` is referentially stable — safe to pass straight into a dependency array — even
 * though the options object and its callbacks are re-created on every render.
 */
export function useApiMutation<
  TData extends object,
  TVariables extends AnyVariables,
  TKey extends keyof TData | undefined = undefined,
  TResult = NonCommonError<TData, TKey>,
>(
  options: UseApiMutationOptions<TData, TVariables, TKey, TResult>,
): UseApiMutation<TVariables, TResult> {
  const [{ fetching, error }, mutate] = useMutation(options.document);

  // Reading the options through a ref keeps `execute` stable across renders while still running
  // the latest callbacks, which close over up-to-date props and state.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(
    async (variables: TVariables): Promise<TResult | void> => {
      const { commonErrorPath, select, successToast, onSuccess, errorToast, errorDescription } =
        optionsRef.current;
      const notificationId = resolve(optionsRef.current.notificationId, variables);
      const errorMessage = resolve(optionsRef.current.errorMessage, variables);

      toast.loading(resolve(optionsRef.current.loadingMessage, variables), { id: notificationId });

      try {
        const res = await mutate(variables);

        // `handleCommonErrors` raises its own error toast and returns nothing when the response
        // carries an error, so a missing result is already reported to the user.
        const data = handleCommonErrors(res, errorMessage, notificationId, commonErrorPath);
        if (!data) {
          return void 0;
        }

        const result = select ? select(data, variables) : (data as unknown as TResult);

        const successOptions = resolve(successToast, result, variables);
        if (successOptions !== false) {
          const { title = 'Success', ...toastOptions } = successOptions ?? {};
          toast.success(title, { ...toastOptions, id: notificationId });
        }

        onSuccess?.(result, variables);

        return result;
      } catch (e) {
        console.error(`${errorMessage}: ${e}`);
        toast.error('Error', {
          description: errorDescription ? errorDescription(e, variables) : errorMessage,
          ...ERROR_TOAST_DEFAULTS,
          ...errorToast,
          id: notificationId,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return { fetching, error, execute };
}
