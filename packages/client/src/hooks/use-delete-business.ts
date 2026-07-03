import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { DeleteBusinessDocument, type DeleteBusinessMutationVariables } from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DeleteBusiness($businessId: UUID!) {
    deleteBusiness(businessId: $businessId)
  }
`;

type UseDeleteBusiness = {
  fetching: boolean;
  deleteBusiness: (variables: DeleteBusinessMutationVariables) => Promise<boolean>;
};

const NOTIFICATION_ID = 'deleteBusiness';

export const useDeleteBusiness = (): UseDeleteBusiness => {
  const [{ fetching }, mutate] = useMutation(DeleteBusinessDocument);
  const deleteBusiness = useCallback(
    async (variables: DeleteBusinessMutationVariables) => {
      const message = `Error deleting business ID [${variables.businessId}]`;
      const notificationId = `${NOTIFICATION_ID}-${variables.businessId}`;
      toast.loading('Deleting business', { id: notificationId });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Business deleted',
          });
          return true;
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

  return { fetching, deleteBusiness };
};
