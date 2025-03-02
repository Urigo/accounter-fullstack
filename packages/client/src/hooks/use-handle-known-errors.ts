import { OperationResult } from 'urql';
import { notifications } from '@mantine/notifications';

type UseHandleKnownErrors = {
  handleKnownErrors: <T>(
    res: OperationResult<T>,
    reject: (reason?: unknown) => void,
    baseMessage: string,
    notificationId?: string,
  ) => T | void;
};

export const useHandleKnownErrors = (): UseHandleKnownErrors => {
  const handleKnownErrors: UseHandleKnownErrors['handleKnownErrors'] = (
    res,
    reject,
    baseMessage,
    notificationId,
  ) => {
    if (res.error) {
      const { error } = res;

      if (error.graphQLErrors?.[0]?.extensions?.code) {
        const graphqlError = error.graphQLErrors[0];
        const {
          message,
          extensions: { code },
        } = graphqlError;
        console.error(code, graphqlError);

        // TODO: handle specific known error codes

        if (notificationId) {
          notifications.update({
            id: notificationId,
            message,
            color: 'red',
            autoClose: 5000,
          });
        }
        return reject(`${baseMessage}: ${message}`);
      }

      console.error(error);
      if (notificationId) {
        notifications.update({
          id: notificationId,
          message: 'Error occurred',
          color: 'red',
          autoClose: 5000,
        });
      }
      return reject(`${baseMessage}: ${res.error.message}`);
    }

    if (!res.data) {
      if (notificationId) {
        notifications.update({
          id: notificationId,
          message: 'Error occurred',
          color: 'red',
          autoClose: 5000,
        });
      }
      return reject(`${baseMessage}: No data`);
    }

    return res.data;
  };

  return {
    handleKnownErrors,
  };
};
