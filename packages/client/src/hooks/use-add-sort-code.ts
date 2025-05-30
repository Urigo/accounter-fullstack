import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { AddSortCodeDocument, AddSortCodeMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddSortCode($key: Int!, $name: String!, $defaultIrsCodes: [Int!]) {
    addSortCode(key: $key, name: $name, defaultIrsCodes: $defaultIrsCodes)
  }
`;

type UseAddSortCode = {
  fetching: boolean;
  addSortCode: (variables: AddSortCodeMutationVariables) => Promise<void>;
};

const NOTIFICATION_ID = 'addSortCode';

export const useAddSortCode = (): UseAddSortCode => {
  // TODO: add authentication
  // TODO: add local data update method after chang e

  const [{ fetching }, mutate] = useMutation(AddSortCodeDocument);
  const addSortCode = useCallback(
    async (variables: AddSortCodeMutationVariables) => {
      const message = `Error adding new sort code [${variables.name}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.name}`;
      toast.loading('Adding sort code', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `"${variables.name}" sort code was successfully added`,
          });
        }
      } catch (e) {
        console.error(`${message}: ${e}`);
        toast.error('Error', {
          id: notificationId,
          description: message,
          duration: 100_000,
          closeButton: true,
        });
      }
      return void 0;
    },
    [mutate],
  );

  return {
    fetching,
    addSortCode,
  };
};
