import { useMemo } from 'react';
import { useQuery } from 'urql';
import { AllOpenContractsDocument, type AllOpenContractsQuery } from '../gql/graphql.js';
import { useQueryErrorToast } from './use-query-error-toast.js';

export type AllOpenContracts = Array<
  NonNullable<AllOpenContractsQuery['allOpenContracts']>[number]
>;

type UseGetContracts = {
  fetching: boolean;
  refresh: () => void;
  openContracts: AllOpenContracts;
  selectableOpenContracts: Array<{ value: string; label: string }>;
};

export const useGetOpenContracts = (): UseGetContracts => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllOpenContractsDocument,
  });

  useQueryErrorToast(error, 'contracts');

  const openContracts = useMemo(() => {
    return (
      data?.allOpenContracts
        ?.slice()
        .sort((a, b) =>
          a.client.originalBusiness.name > b.client.originalBusiness.name ? 1 : -1,
        ) ?? []
    );
  }, [data]);

  const selectableOpenContracts = useMemo(() => {
    return openContracts.map(entity => ({
      value: entity.id,
      label: entity.client.originalBusiness.name,
    }));
  }, [openContracts]);

  return {
    fetching,
    refresh: () => fetch(),
    openContracts,
    selectableOpenContracts,
  };
};
