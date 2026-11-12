import {
  InsertTaxCategoryDocument,
  type InsertTaxCategoryMutation,
  type InsertTaxCategoryMutationVariables,
} from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: InsertTaxCategoryDocument,
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Adding Tax Category',
    errorMessage: 'Error creating tax category',
    select: data => data.insertTaxCategory,
    successToast: taxCategory => ({ description: `${taxCategory.name} was created` }),
  });

  return {
    fetching,
    insertTaxCategory: execute,
  };
};
