import { toast } from 'sonner';
import { OperationResult } from 'urql';

type NonCommonError<T, K extends keyof T | undefined = undefined> = K extends keyof T
  ? Omit<T, K> & { [K in keyof T]: Exclude<T[K], { __typename: 'CommonError' }> }
  : T;

export function handleCommonErrors<T extends object, K extends undefined | keyof T>(
  res: OperationResult<T>,
  baseMessage: string,
  notificationId: string,
  commonErrorPath?: K,
): NonCommonError<T, K> | void {
  try {
    if (res.error) {
      const { error } = res;

      if (error.graphQLErrors?.[0]?.extensions?.code) {
        const graphqlError = error.graphQLErrors[0];
        const {
          message,
          extensions: { code },
        } = graphqlError;
        console.error(`Error ${code} - ${baseMessage}: ${graphqlError}`);

        // TODO: handle specific known error codes

        throw new Error(message);
      }

      console.error(error);
      throw new Error(`${baseMessage}: Error occurred`);
    }

    if (!res.data) {
      throw new Error(`${baseMessage}: No data`);
    }

    // handle common error
    if (commonErrorPath && typeof res.data === 'object') {
      const data = res.data as T;
      if (commonErrorPath in data && typeof data[commonErrorPath] === 'object') {
        const content = data[commonErrorPath] as Record<string, unknown>;
        if ('__typename' in content && content.__typename === 'CommonError') {
          console.error(`${baseMessage}: ${content}`);
          throw new Error(content.message as string);
        }
      }
    }

    return res.data as NonCommonError<T, K>;
  } catch (e) {
    toast.error('Error', {
      id: notificationId,
      description: (e as Error).message,
      duration: 100_000,
      closeButton: true,
    });
    return void 0;
  }
}
