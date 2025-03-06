import { useCallback } from 'react';
import { useMutation } from 'urql';
import { notifications } from '@mantine/notifications';
import {
  GenerateBalanceChargeDocument,
  GenerateBalanceChargeMutation,
  GenerateBalanceChargeMutationVariables,
} from '../gql/graphql.js';
import { useHandleKnownErrors } from './use-handle-known-errors.js';

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
  ) => Promise<GenerateBalanceChargeMutation['generateBalanceCharge']>;
};

const NOTIFICATION_ID = 'generateBalanceCharge';

export const useGenerateBalanceCharge = (): UseGenerateBalanceCharge => {
  // TODO: add authentication
  // TODO: add local data update method after insert

  const [{ fetching }, mutate] = useMutation(GenerateBalanceChargeDocument);
  const { handleKnownErrors } = useHandleKnownErrors();

  const generateBalanceCharge = useCallback(
    async (
      variables: GenerateBalanceChargeMutationVariables,
    ): Promise<GenerateBalanceChargeMutation['generateBalanceCharge']> => {
      const notificationId = NOTIFICATION_ID;

      return new Promise<GenerateBalanceChargeMutation['generateBalanceCharge']>(
        (resolve, reject) => {
          notifications.show({
            id: notificationId,
            loading: true,
            title: 'Generating balance charge',
            message: 'Please wait...',
            autoClose: false,
            withCloseButton: true,
          });

          return mutate(variables).then(res => {
            const message = 'Error generating charge';
            const data = handleKnownErrors(res, reject, message, notificationId);
            if (!data) {
              return;
            }
            notifications.update({
              id: notificationId,
              title: 'Generation Successful!',
              autoClose: 5000,
              message: 'Balance charge was created',
              withCloseButton: true,
            });
            return resolve(data.generateBalanceCharge);
          });
        },
      );
    },
    [mutate, handleKnownErrors],
  );

  return {
    fetching,
    generateBalanceCharge,
  };
};
