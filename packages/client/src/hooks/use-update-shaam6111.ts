import {
  UpdateShaam6111Document,
  type UpdateShaam6111Mutation,
  type UpdateShaam6111MutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateShaam6111(
    $businessId: UUID
    $year: Int!
    $header: Shaam6111HeaderInput
    $taxAdjustmentOverrides: [Shaam6111LineOverrideInput!]
  ) {
    updateShaam6111(
      businessId: $businessId
      year: $year
      header: $header
      taxAdjustmentOverrides: $taxAdjustmentOverrides
    )
  }
`;

type UseUpdateShaam6111 = {
  fetching: boolean;
  updateShaam6111: (
    variables: UpdateShaam6111MutationVariables,
  ) => Promise<UpdateShaam6111Mutation['updateShaam6111'] | void>;
};

export const useUpdateShaam6111 = (): UseUpdateShaam6111 => {
  const { fetching, execute } = useApiMutation({
    document: UpdateShaam6111Document,
    notificationId: variables => `updateShaam6111-${variables.businessId}-${variables.year}`,
    loadingMessage: 'Saving 6111 settings',
    errorMessage: 'Error saving 6111 settings',
    select: data => data.updateShaam6111,
    successToast: { description: '6111 settings saved' },
  });

  return {
    fetching,
    updateShaam6111: execute,
  };
};
