import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllAdminBusinessesDocument, type AllAdminBusinessesQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllAdminBusinesses {
    allAdminBusinesses {
      id
      name
      governmentId
    }
  }
`;

export type AdminBusinesses = NonNullable<AllAdminBusinessesQuery['allAdminBusinesses']>;

type UseGetAdminBusinesses = {
  fetching: boolean;
  refresh: () => void;
  adminBusinesses: AdminBusinesses;
  selectableAdminBusinesses: Array<{ value: string; label: string }>;
  /**
   * The single business the caller may act as owner of, or null when there are
   * several (or none). An owner input with one option is not a choice — callers
   * pre-select this value and disable the input.
   */
  soleAdminBusinessId: string | null;
};

export const useGetAdminBusinesses = (): UseGetAdminBusinesses => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllAdminBusinessesDocument,
  });

  useEffect(() => {
    if (error) {
      console.error(`Error fetching admin businesses: ${error}`);
      toast.error('Error', {
        description: 'Unable to fetch admin businesses',
      });
    }
  }, [error]);

  const adminBusinesses = useMemo(() => {
    return data?.allAdminBusinesses?.slice().sort((a, b) => a.name.localeCompare(b.name)) ?? [];
  }, [data]);

  const selectableAdminBusinesses = useMemo(() => {
    return adminBusinesses.map(entity => ({
      value: entity.id,
      label: entity.name,
    }));
  }, [adminBusinesses]);

  const soleAdminBusinessId =
    selectableAdminBusinesses.length === 1 ? selectableAdminBusinesses[0].value : null;

  return {
    fetching,
    refresh: () => fetch(),
    adminBusinesses,
    selectableAdminBusinesses,
    soleAdminBusinessId,
  };
};
