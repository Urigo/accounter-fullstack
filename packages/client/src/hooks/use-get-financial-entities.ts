import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllFinancialEntitiesDocument, type AllFinancialEntitiesQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllFinancialEntities {
    allFinancialEntities {
      nodes {
        id
        name
      }
    }
  }
`;

type AllCountries = Array<
  NonNullable<AllFinancialEntitiesQuery['allFinancialEntities']>['nodes'][number]
>;

type UseGetFinancialEntities = {
  fetching: boolean;
  refresh: () => void;
  financialEntities: AllCountries;
  selectableFinancialEntities: Array<{ value: string; label: string }>;
};

export const useGetFinancialEntities = (): UseGetFinancialEntities => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  if (error) {
    console.error(`Error fetching financial entities: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch financial entities',
    });
  }

  const financialEntities = useMemo(() => {
    return data?.allFinancialEntities?.nodes.sort((a, b) => (a.name > b.name ? 1 : -1)) ?? [];
  }, [data]);

  const selectableFinancialEntities = useMemo(() => {
    return financialEntities.map(entity => ({
      value: entity.id,
      label: entity.name,
    }));
  }, [financialEntities]);

  return {
    fetching,
    refresh: () => fetch(),
    financialEntities,
    selectableFinancialEntities,
  };
};
