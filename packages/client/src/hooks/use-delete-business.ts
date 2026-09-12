import { useCallback } from 'react';
import { DeleteBusinessDocument, type DeleteBusinessMutationVariables } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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
  const { fetching, execute } = useApiMutation({
    document: DeleteBusinessDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.businessId}`,
    loadingMessage: 'Deleting business',
    errorMessage: variables => `Error deleting business ID [${variables.businessId}]`,
    select: () => true,
    successToast: { description: 'Business deleted' },
  });

  const deleteBusiness = useCallback(
    async (variables: DeleteBusinessMutationVariables) => (await execute(variables)) ?? false,
    [execute],
  );

  return { fetching, deleteBusiness };
};
