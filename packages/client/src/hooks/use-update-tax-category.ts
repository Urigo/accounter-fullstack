import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  UpdateTaxCategoryDocument,
  type UpdateTaxCategoryMutation,
  type UpdateTaxCategoryMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

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

  const [{ fetching }, mutate] = useMutation(UpdateTaxCategoryDocument);
  const updateTaxCategory = useCallback(
    async (variables: UpdateTaxCategoryMutationVariables) => {
      const message = 'Error updating tax category';
      const notificationId = `${NOTIFICATION_ID}-${variables.taxCategoryId}`;
      toast.loading('Uploading Tax Category', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId, 'updateTaxCategory');
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `${data.updateTaxCategory.name} was updated`,
          });
          return data.updateTaxCategory;
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
    updateTaxCategory,
  };
};
