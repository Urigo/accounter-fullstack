import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  InsertTaxCategoryDocument,
  type InsertTaxCategoryMutation,
  type InsertTaxCategoryMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation InsertTaxCategory($fields: InsertTaxCategoryInput!) {
    insertTaxCategory(fields: $fields) {
      id
      name
    }
  }
`;

type InsertTaxCategorySuccessfulResult = InsertTaxCategoryMutation['insertTaxCategory'];

type UseInsertTaxCategory = {
  fetching: boolean;
  insertTaxCategory: (
    variables: InsertTaxCategoryMutationVariables,
  ) => Promise<InsertTaxCategorySuccessfulResult | void>;
};

const NOTIFICATION_ID = 'insertTaxCategory';

export const useInsertTaxCategory = (): UseInsertTaxCategory => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(InsertTaxCategoryDocument);
  const insertTaxCategory = useCallback(
    async (variables: InsertTaxCategoryMutationVariables) => {
      const message = 'Error creating tax category';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Adding Tax Category', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: `${data.insertTaxCategory.name} was created`,
          });
          return data.insertTaxCategory;
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
    insertTaxCategory,
  };
};
