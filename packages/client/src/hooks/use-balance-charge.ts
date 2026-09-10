import {
  GenerateBalanceChargeDocument,
  type GenerateBalanceChargeMutation,
  type GenerateBalanceChargeMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

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

  const { fetching, execute } = useApiMutation({
    document: GenerateBalanceChargeDocument,
    notificationId: NOTIFICATION_ID,
    loadingMessage: 'Generating balance charge',
    errorMessage: 'Error generating charge',
    select: data => data.generateBalanceCharge,
    successToast: { description: 'Balance charge was created' },
  });

  return {
    fetching,
    generateBalanceCharge: execute,
  };
};
