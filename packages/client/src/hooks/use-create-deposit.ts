import { useCallback } from 'react';
import type { TimelessDateString } from '@/helpers/index.js';
import { CreateDepositDocument, type Currency } from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CreateDeposit(
    $name: String!
    $currency: Currency!
    $openDate: TimelessDate!
    $accountId: UUID
  ) {
    createDeposit(name: $name, currency: $currency, openDate: $openDate, accountId: $accountId) {
      id
      currency
      isOpen
    }
  }
`;

type CreateDepositVars = {
  name: string;
  currency: Currency;
  openDate: TimelessDateString;
  accountId?: string;
};

type UseCreateDeposit = {
  creating: boolean;
  createDeposit: (variables: CreateDepositVars) => Promise<string | null>;
};

const NOTIFICATION_ID = 'createDeposit';

export const useCreateDeposit = (): UseCreateDeposit => {
  const { fetching, execute } = useApiMutation({
    document: CreateDepositDocument,
    notificationId: variables =>
      `${NOTIFICATION_ID}-${variables.name}-${variables.currency}-${variables.openDate}-${variables.accountId ?? 'noAccount'}`,
    loadingMessage: 'Creating deposit',
    errorMessage: variables => `Error creating new deposit ${variables.name}`,
    select: data => data.createDeposit,
    successToast: deposit => ({
      title: 'Deposit created',
      description: `Deposit ${deposit.id} (${deposit.currency}) created successfully`,
    }),
  });

  const createDeposit = useCallback(
    async (variables: CreateDepositVars) => (await execute(variables))?.id ?? null,
    [execute],
  );

  return {
    creating: fetching,
    createDeposit,
  };
};
