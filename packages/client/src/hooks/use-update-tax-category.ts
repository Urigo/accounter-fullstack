import {
  UpdateTaxCategoryDocument,
  type UpdateTaxCategoryMutation,
  type UpdateTaxCategoryMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UpdateTaxCategory($taxCategoryId: UUID!, $fields: UpdateTaxCategoryInput!) {
    updateTaxCategory(taxCategoryId: $taxCategoryId, fields: $fields) {
      __typename
      ... on TaxCategory {
        id
        name
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type TaxCategory = Extract<
  UpdateTaxCategoryMutation['updateTaxCategory'],
  { __typename: 'TaxCategory' }
>;

type UseUpdateTaxCategory = {
  fetching: boolean;
  updateTaxCategory: (variables: UpdateTaxCategoryMutationVariables) => Promise<TaxCategory | void>;
};

const NOTIFICATION_ID = 'updateTaxCategory';

export const useUpdateTaxCategory = (): UseUpdateTaxCategory => {
  // TODO: add authentication
  // TODO: add local data update method after change

  const { fetching, execute } = useApiMutation({
    document: UpdateTaxCategoryDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.taxCategoryId}`,
    loadingMessage: 'Uploading Tax Category',
    errorMessage: 'Error updating tax category',
    commonErrorPath: 'updateTaxCategory',
    select: data => data.updateTaxCategory,
    successToast: taxCategory => ({ description: `${taxCategory.name} was updated` }),
  });

  return {
    fetching,
    updateTaxCategory: execute,
  };
};
