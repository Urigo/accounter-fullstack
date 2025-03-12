import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import {
  GenerateBalanceChargeDocument,
  GenerateBalanceChargeMutation,
  GenerateBalanceChargeMutationVariables,
} from '../gql/graphql.js';
import { handleCommonErrors } from '../helpers/error-handling.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation GenerateBalanceCharge(
    $description: String!
    $balanceRecords: [InsertMiscExpenseInput!]!
  ) {
    generateBalanceCharge(description: $description, balanceRecords: $balanceRecords) {
      id
    }
  }
`;

type UseGenerateBalanceCharge = {
  fetching: boolean;
  generateBalanceCharge: (
    variables: GenerateBalanceChargeMutationVariables,
  ) => Promise<GenerateBalanceChargeMutation['generateBalanceCharge'] | void>;
};

const NOTIFICATION_ID = 'generateBalanceCharge';

export const useGenerateBalanceCharge = (): UseGenerateBalanceCharge => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(GenerateBalanceChargeDocument);
  const generateBalanceCharge = useCallback(
    async (variables: GenerateBalanceChargeMutationVariables) => {
      const message = 'Error generating charge';
      const notificationId = NOTIFICATION_ID;
      toast.loading('Generating balance charge', {
        id: notificationId,
      });
      try {
        const res = await mutate(variables);
        const data = handleCommonErrors(res, message, notificationId);
        if (data) {
          toast.success('Success', {
            id: notificationId,
            description: 'Balance charge was created',
          });
          return data.generateBalanceCharge;
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
    generateBalanceCharge,
  };
};
