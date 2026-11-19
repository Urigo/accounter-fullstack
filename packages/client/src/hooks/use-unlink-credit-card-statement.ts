import {
  UnlinkCreditCardStatementDocument,
  type UnlinkCreditCardStatementMutation,
  type UnlinkCreditCardStatementMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation UnlinkCreditCardStatement(
    $bankTransactionId: UUID!
    $statement: CreditCardStatementKeyInput!
  ) {
    unlinkCreditCardStatement(bankTransactionId: $bankTransactionId, statement: $statement) {
      __typename
      ... on CreditCardStatementLinkSuccessfulResult {
        charge {
          id
          ...ChargeMutationResultFields
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Charge = Extract<
  UnlinkCreditCardStatementMutation['unlinkCreditCardStatement'],
  { __typename: 'CreditCardStatementLinkSuccessfulResult' }
>['charge'];

type UseUnlinkCreditCardStatement = {
  fetching: boolean;
  /** Removes a stored link between a bank debit and a card statement. */
  unlinkCreditCardStatement: (
    variables: UnlinkCreditCardStatementMutationVariables,
  ) => Promise<Charge | void>;
};

const NOTIFICATION_ID = 'unlinkCreditCardStatement';

export const useUnlinkCreditCardStatement = (): UseUnlinkCreditCardStatement => {
  const { fetching, execute } = useApiMutation({
    document: UnlinkCreditCardStatementDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.bankTransactionId}`,
    loadingMessage: 'Unlinking card statement',
    errorMessage: 'Error unlinking card statement',
    commonErrorPath: 'unlinkCreditCardStatement',
    select: data => data.unlinkCreditCardStatement.charge,
    successToast: { description: 'Card statement unlinked' },
  });

  return {
    fetching,
    unlinkCreditCardStatement: execute,
  };
};
