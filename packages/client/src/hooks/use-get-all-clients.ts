import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllClientsDocument, type AllClientsQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllClients {
    allClients {
      id
      originalBusiness {
        id
        name
      }
    }
  }
`;

export type AllClients = Array<NonNullable<AllClientsQuery['allClients']>[number]>;

type UseGetAllClients = {
  fetching: boolean;
  refresh: () => void;
  clients: AllClients;
  selectableClients: Array<{ value: string; label: string }>;
};

export const useGetAllClients = (): UseGetAllClients => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllClientsDocument,
  });

  if (error) {
    console.error(`Error fetching clients: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch clients',
    });
  }

  const clients = useMemo(() => {
    return (
      data?.allClients
        ?.slice()
        .sort((a, b) => (a.originalBusiness.name > b.originalBusiness.name ? 1 : -1)) ?? []
    );
  }, [data]);

  const selectableClients = useMemo(() => {
    return clients.map(entity => ({
      value: entity.originalBusiness.id,
      label: entity.originalBusiness.name,
    }));
  }, [clients]);

  return {
    fetching,
    refresh: () => fetch(),
    clients,
    selectableClients,
  };
};
