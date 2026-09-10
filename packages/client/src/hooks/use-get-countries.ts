import { useQuery } from 'urql';
import { AllCountriesDocument, type AllCountriesQuery } from '../gql/graphql.js';
import { useQueryErrorToast } from './use-query-error-toast.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllCountries {
    allCountries {
      id
      name
      code
    }
  }
`;

type AllCountries = Array<Omit<AllCountriesQuery['allCountries'][number], '__typename' | 'id'>>;

type UseAllCountries = {
  fetching: boolean;
  refresh: () => void;
  countries: AllCountries;
};

export const useAllCountries = (): UseAllCountries => {
  const [{ data, fetching, error }, fetch] = useQuery({ query: AllCountriesDocument });

  useQueryErrorToast(error, 'countries');

  return {
    fetching,
    refresh: () => fetch(),
    countries: data?.allCountries ?? [],
  };
};
