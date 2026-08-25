import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  AllFinancialAccountsDocument,
  type AllFinancialAccountsQuery,
  type FinancialAccountType,
} from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllFinancialAccounts {
    allFinancialAccounts {
      id
      name
      type
    }
  }
`;

type AllFinancialAccounts = Array<
  NonNullable<AllFinancialAccountsQuery['allFinancialAccounts']>[number]
>;

type UseGetFinancialAccounts = {
  fetching: boolean;
  refresh: () => void;
  financialAccounts: AllFinancialAccounts;
  selectableFinancialAccounts: Array<{
    value: string;
    label: string;
    type: FinancialAccountType;
  }>;
};

export const useGetFinancialAccounts = (): UseGetFinancialAccounts => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllFinancialAccountsDocument,
  });

  if (error) {
    console.error(`Error fetching financial accounts: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch financial accounts',
    });
  }

  const financialAccounts = useMemo(() => {
    return data?.allFinancialAccounts?.sort((a, b) => (a.name > b.name ? 1 : -1)) ?? [];
  }, [data]);

  const selectableFinancialAccounts = useMemo(() => {
    return financialAccounts.map(account => ({
      value: account.id,
      label: account.name,
      type: account.type,
    }));
  }, [financialAccounts]);

  return {
    fetching,
    refresh: () => fetch(),
    financialAccounts,
    selectableFinancialAccounts,
  };
};
