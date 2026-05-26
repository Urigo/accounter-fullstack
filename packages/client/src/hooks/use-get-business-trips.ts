import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllBusinessTripsDocument, type AllBusinessTripsQuery } from '../gql/graphql.js';

type BusinessTrips = Array<NonNullable<AllBusinessTripsQuery['allBusinessTrips']>[number]>;

type UseGetBusinessTrips = {
  fetching: boolean;
  refresh: () => void;
  businessTrips: BusinessTrips;
  selectableBusinessTrips: Array<{ value: string; label: string }>;
};

export const useGetBusinessTrips = (): UseGetBusinessTrips => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllBusinessTripsDocument,
  });

  if (error) {
    console.error(`Error fetching business trips: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch business trips',
    });
  }

  const businessTrips = useMemo(() => {
    return [...(data?.allBusinessTrips ?? [])].sort((a, b) => (a.name > b.name ? 1 : -1));
  }, [data]);

  const selectableBusinessTrips = useMemo(() => {
    return businessTrips.map(entity => ({
      value: entity.id,
      label: entity.name,
    }));
  }, [businessTrips]);

  return {
    fetching,
    refresh: () => fetch(),
    businessTrips,
    selectableBusinessTrips,
  };
};
