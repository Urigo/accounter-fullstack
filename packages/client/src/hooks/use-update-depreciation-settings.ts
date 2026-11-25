import {
  UpdateDepreciationSettingsDocument,
  type UpdateDepreciationSettingsMutation,
  type UpdateDepreciationSettingsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateDepreciationSettings($context: AdminContextInput!) {
    updateAdminContext(context: $context) {
      id
    }
  }
`;

type UseUpdateDepreciationSettings = {
  fetching: boolean;
  updateDepreciationSettings: (
    variables: UpdateDepreciationSettingsMutationVariables,
  ) => Promise<UpdateDepreciationSettingsMutation['updateAdminContext'] | void>;
};

export const useUpdateDepreciationSettings = (): UseUpdateDepreciationSettings => {
  const { fetching, execute } = useApiMutation({
    document: UpdateDepreciationSettingsDocument,
    notificationId: 'updateDepreciationSettings',
    loadingMessage: 'Saving depreciation settings',
    errorMessage: 'Error saving depreciation settings',
    select: data => data.updateAdminContext,
    successToast: { description: 'Depreciation settings were saved' },
  });

  return { fetching, updateDepreciationSettings: execute };
};
