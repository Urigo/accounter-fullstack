import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllBusinessesDocument, AllBusinessesQuery } from '../gql/graphql.js';

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

  if (error) {
    console.error(`Error fetching businesses: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch businesses',
    });
  }

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
