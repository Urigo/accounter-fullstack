import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllSortCodesDocument, AllSortCodesQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllSortCodes {
    allSortCodes {
      id
      key
      name
    }
  }
`;

type SortCodes = Array<NonNullable<AllSortCodesQuery['allSortCodes']>[number]>;

type UseGetSortCodes = {
  fetching: boolean;
  refresh: () => void;
  sortCodes: SortCodes;
  selectableSortCodes: Array<{ value: string; label: string }>;
};

export const useGetSortCodes = (): UseGetSortCodes => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllSortCodesDocument,
  });

  if (error) {
    console.error(`Error fetching sort codes: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch sort codes',
    });
  }

  const sortCodes = useMemo(() => {
    return data?.allSortCodes?.sort((a, b) => ((a.name ?? '') > (b.name ?? '') ? 1 : -1)) ?? [];
  }, [data]);

  const selectableSortCodes = useMemo(() => {
    return sortCodes.map(entity => ({
      value: entity.key.toString(),
      label: entity.name ?? '',
    }));
  }, [sortCodes]);

  return {
    fetching,
    refresh: () => fetch(),
    sortCodes,
    selectableSortCodes,
  };
};
