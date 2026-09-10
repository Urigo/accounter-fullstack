import { useMemo } from 'react';
import { useQuery } from 'urql';
import { AllBusinessesDocument, type AllBusinessesQuery } from '../gql/graphql.js';
import { useQueryErrorToast } from './use-query-error-toast.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllBusinesses {
    allBusinesses {
      nodes {
        id
        name
      }
    }
  }
`;

type Businesses = Array<NonNullable<AllBusinessesQuery['allBusinesses']>['nodes'][number]>;

type UseGetBusinesses = {
  fetching: boolean;
  refresh: () => void;
  businesses: Businesses;
  selectableBusinesses: Array<{ value: string; label: string }>;
};

export const useGetBusinesses = (): UseGetBusinesses => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllBusinessesDocument,
  });

  useQueryErrorToast(error, 'businesses');

  const businesses = useMemo(() => {
    return data?.allBusinesses?.nodes.sort((a, b) => (a.name > b.name ? 1 : -1)) ?? [];
  }, [data]);

  const selectableBusinesses = useMemo(() => {
    return businesses.map(entity => ({
      value: entity.id,
      label: entity.name,
    }));
  }, [businesses]);

  return {
    fetching,
    refresh: () => fetch(),
    businesses,
    selectableBusinesses,
  };
};
