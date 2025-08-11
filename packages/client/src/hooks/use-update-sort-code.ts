import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { UpdateSortCodeDocument, type UpdateSortCodeMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateSortCode($key: Int!, $fields: UpdateSortCodeFieldsInput!) {
    updateSortCode(key: $key, fields: $fields)
  }
`;

type UseUpdateSortCode = {
  fetching: boolean;
  updateSortCode: (variables: UpdateSortCodeMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'updateSortCode';

export const useUpdateSortCode = (): UseUpdateSortCode => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const [{ fetching }, mutate] = useMutation(UpdateSortCodeDocument);
  const updateSortCode = useCallback(
    async (variables: UpdateSortCodeMutationVariables) => {
      const message = `Error updating sort code ID [${variables.key}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.key}`;
      toast.loading('Updating Sort Code...', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateSortCode');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'SortCode updated',
          });
          return data.updateSortCode;
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
      return false;
    },
    [mutate],
  );

  return {
    fetching,
    updateSortCode,
  };
};
