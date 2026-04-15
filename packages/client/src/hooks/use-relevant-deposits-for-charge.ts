import { useQuery } from 'urql';
import { RelevantDepositsForChargeDocument } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query RelevantDepositsForCharge($chargeId: UUID!) {
    relevantDepositsForCharge(chargeId: $chargeId) {
      id
      deposits {
        id
        name
        currency
        isOpen
      }
      error
    }
  }
`;

export const useRelevantDepositsForCharge = (chargeId: string) => {
  const [{ data, fetching, error }] = useQuery({
    query: RelevantDepositsForChargeDocument,
    variables: { chargeId },
  });

  return {
    fetching,
    error,
    deposits: data?.relevantDepositsForCharge.deposits ?? [],
    conflictError: data?.relevantDepositsForCharge.error ?? null,
  };
};
