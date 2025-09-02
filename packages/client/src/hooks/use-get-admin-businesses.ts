import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AdminBusinessesDocument, type AdminBusinessesQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AdminBusinesses {
    allAdminBusinesses {
      id
      name
      governmentId
    }
  }
`;

export type AdminBusinesses = Array<
  NonNullable<AdminBusinessesQuery['allAdminBusinesses']>[number]
>;

type UseGetAdminBusinesses = {
  fetching: boolean;
  refresh: () => void;
  adminBusinesses: AdminBusinesses;
  selectableAdminBusinesses: Array<{ value: string; label: string }>;
};

export const useGetAdminBusinesses = (): UseGetAdminBusinesses => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AdminBusinessesDocument,
  });

  if (error) {
    console.error(`Error fetching admin businesses: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch admin businesses',
    });
  }

  const adminBusinesses = useMemo(() => {
    return data?.allAdminBusinesses?.slice().sort((a, b) => (a.name > b.name ? 1 : -1)) ?? [];
  }, [data]);

  const selectableAdminBusinesses = useMemo(() => {
    return adminBusinesses.map(entity => ({
      value: entity.id,
      label: entity.name,
    }));
  }, [adminBusinesses]);

  return {
    fetching,
    refresh: () => fetch(),
    adminBusinesses,
    selectableAdminBusinesses,
  };
};
