import {
  LinkCreditCardStatementsDocument,
  type LinkCreditCardStatementsMutation,
  type LinkCreditCardStatementsMutationVariables,
} from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation LinkCreditCardStatements(
    $bankTransactionId: UUID!
    $statements: [CreditCardStatementKeyInput!]!
  ) {
    linkCreditCardStatements(bankTransactionId: $bankTransactionId, statements: $statements) {
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
  LinkCreditCardStatementsMutation['linkCreditCardStatements'],
  { __typename: 'CreditCardStatementLinkSuccessfulResult' }
>['charge'];

type UseLinkCreditCardStatements = {
  fetching: boolean;
  /** Links (or confirms) the statements a bank debit settles. Resolves to the updated charge. */
  linkCreditCardStatements: (
    variables: LinkCreditCardStatementsMutationVariables,
  ) => Promise<Charge | void>;
};

const NOTIFICATION_ID = 'linkCreditCardStatements';

export const useLinkCreditCardStatements = (): UseLinkCreditCardStatements => {
  // creates link records: guard against an accidental repeat
  const { fetching, execute } = useApiMutation({
    document: LinkCreditCardStatementsDocument,
    notificationId: variables => `${NOTIFICATION_ID}-${variables.bankTransactionId}`,
    loadingMessage: 'Linking card statement',
    errorMessage: 'Error linking card statement',
    commonErrorPath: 'linkCreditCardStatements',
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
    select: data => data.linkCreditCardStatements.charge,
    successToast: { description: 'Card statement linked' },
  });

  return {
    fetching,
    linkCreditCardStatements: execute,
  };
};
