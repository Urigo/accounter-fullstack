import { useMemo } from 'react';
import { useQuery } from 'urql';
import { AllTaxCategoriesDocument, type AllTaxCategoriesQuery } from '../gql/graphql.js';
import { useQueryErrorToast } from './use-query-error-toast.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllTaxCategories {
    taxCategories {
      id
      name
    }
  }
`;

type AllCountries = Array<NonNullable<AllTaxCategoriesQuery['taxCategories']>[number]>;

type UseGetTaxCategories = {
  fetching: boolean;
  refresh: () => void;
  taxCategories: AllCountries;
  selectableTaxCategories: Array<{ value: string; label: string }>;
};

export const useGetTaxCategories = (): UseGetTaxCategories => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllTaxCategoriesDocument,
  });

  useQueryErrorToast(error, 'tax categories');

  const taxCategories = useMemo(() => {
    return data?.taxCategories?.sort((a, b) => (a.name > b.name ? 1 : -1)) ?? [];
  }, [data]);

  const selectableTaxCategories = useMemo(() => {
    return taxCategories.map(entity => ({
      value: entity.id,
      label: entity.name,
    }));
  }, [taxCategories]);

  return {
    fetching,
    refresh: () => fetch(),
    taxCategories,
    selectableTaxCategories,
  };
};
