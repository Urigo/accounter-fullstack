import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllGreenInvoiceClientsDocument, AllGreenInvoiceClientsQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllGreenInvoiceClients {
    greenInvoiceBusinesses {
      id
      originalBusiness {
        id
        name
      }
    }
  }
`;

type AllGreenInvoiceClients = Array<
  NonNullable<AllGreenInvoiceClientsQuery['greenInvoiceBusinesses']>[number]
>;

type UseGetGreenInvoiceClients = {
  fetching: boolean;
  refresh: () => void;
  greenInvoiceClients: AllGreenInvoiceClients;
  selectableGreenInvoiceClients: Array<{ value: string; label: string }>;
};

export const useGetGreenInvoiceClients = (): UseGetGreenInvoiceClients => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllGreenInvoiceClientsDocument,
  });

  if (error) {
    console.error(`Error fetching green invoice clients: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch green invoice clients',
    });
  }

  const greenInvoiceClients = useMemo(() => {
    return (
      data?.greenInvoiceBusinesses
        ?.slice()
        .sort((a, b) => (a.originalBusiness.name > b.originalBusiness.name ? 1 : -1)) ?? []
    );
  }, [data]);

  const selectableGreenInvoiceClients = useMemo(() => {
    return greenInvoiceClients.map(entity => ({
      value: entity.id,
      label: entity.originalBusiness.name,
    }));
  }, [greenInvoiceClients]);

  return {
    fetching,
    refresh: () => fetch(),
    greenInvoiceClients,
    selectableGreenInvoiceClients,
  };
};
