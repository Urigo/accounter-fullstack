import {
  DismissCreditCardStatementsDocument,
  type DismissCreditCardStatementsMutation,
  type DismissCreditCardStatementsMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation DismissCreditCardStatements(
    $bankTransactionId: UUID!
    $statements: [CreditCardStatementKeyInput!]!
  ) {
    dismissCreditCardStatements(bankTransactionId: $bankTransactionId, statements: $statements) {
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
  DismissCreditCardStatementsMutation['dismissCreditCardStatements'],
  { __typename: 'CreditCardStatementLinkSuccessfulResult' }
>['charge'];

type UseDismissCreditCardStatements = {
  fetching: boolean;
  /**
   * Rejects a computed match without linking it: the statements are not proposed again for this
   * bank debit. Resolves to the updated charge.
   */
  dismissCreditCardStatements: (
    variables: DismissCreditCardStatementsMutationVariables,
  ) => Promise<Charge | void>;
};

const NOTIFICATION_ID = 'dismissCreditCardStatements';

export const useDismissCreditCardStatements = (): UseDismissCreditCardStatements => {
  // idempotent on the server (like unlink), so no dedupe
  const { fetching, execute } = useApiMutation({
    document: DismissCreditCardStatementsDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.bankTransactionId}`,
    loadingMessage: 'Dismissing card statement match',
    errorMessage: 'Error dismissing card statement match',
    commonErrorPath: 'dismissCreditCardStatements',
    select: data => data.dismissCreditCardStatements.charge,
    successToast: { description: 'Card statement match dismissed' },
  });

  return {
    fetching,
    dismissCreditCardStatements: execute,
  };
};
