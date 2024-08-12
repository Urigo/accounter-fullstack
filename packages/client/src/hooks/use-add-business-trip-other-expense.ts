import { useMutation } from 'urql';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripOtherExpenseDocument,
  AddBusinessTripOtherExpenseMutation,
  AddBusinessTripOtherExpenseMutationVariables,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation AddBusinessTripOtherExpense($fields: AddBusinessTripOtherExpenseInput!) {
    addBusinessTripOtherExpense(fields: $fields)
  }
`;

type UseAddBusinessTripOtherExpense = {
  fetching: boolean;
  addBusinessTripOtherExpense: (
    variables: AddBusinessTripOtherExpenseMutationVariables,
  ) => Promise<AddBusinessTripOtherExpenseMutation['addBusinessTripOtherExpense']>;
};

export const useAddBusinessTripOtherExpense = (): UseAddBusinessTripOtherExpense => {
  // TODO: add authentication
  // TODO: add local data update method after update

  const [{ fetching }, mutate] = useMutation(AddBusinessTripOtherExpenseDocument);

  return {
    fetching,
    addBusinessTripOtherExpense: (
      variables: AddBusinessTripOtherExpenseMutationVariables,
    ): Promise<AddBusinessTripOtherExpenseMutation['addBusinessTripOtherExpense']> =>
      new Promise<AddBusinessTripOtherExpenseMutation['addBusinessTripOtherExpense']>(
        (resolve, reject) =>
          mutate(variables).then(res => {
            if (res.error) {
              console.error(`Error adding business trip "other" expense: ${res.error}`);
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" expense was not added',
              });
              return reject(res.error.message);
            }
            if (!res.data) {
              console.error('Error adding business trip "other" expense: No data returned');
              showNotification({
                title: 'Error!',
                message: 'Oops, "other" expense was not added',
              });
              return reject('No data returned');
            }
            showNotification({
              title: 'Success!',
              message: 'Business trip "other" expense was added! 🎉',
            });
            return resolve(res.data.addBusinessTripOtherExpense);
          }),
      ),
  };
};
