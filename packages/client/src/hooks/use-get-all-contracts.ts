import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllOpenContractsDocument, AllOpenContractsQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllOpenContracts {
    allOpenContracts {
      id
      client {
        id
        greenInvoiceId
        emails
        originalBusiness {
          id
          name
        }
      }
      purchaseOrder
      startDate
      endDate
      remarks
      amount {
        raw
        currency
        formatted
      }
      documentType
      billingCycle
      isActive
      product
      plan
      signedAgreement
      msCloud
    }
  }
`;

type AllOpenContracts = Array<NonNullable<AllOpenContractsQuery['allOpenContracts']>[number]>;

type UseGetContracts = {
  fetching: boolean;
  refresh: () => void;
  openContracts: AllOpenContracts;
  selectableOpenContracts: Array<{ value: string; label: string }>;
};

export const useGetOpenContracts = (): UseGetContracts => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllOpenContractsDocument,
  });

  if (error) {
    console.error(`Error fetching contracts: ${error}`);
    toast.error('Error', {
      description: 'Unable to fetch contracts',
    });
  }

  const openContracts = useMemo(() => {
    return (
      data?.allOpenContracts
        ?.slice()
        .sort((a, b) =>
          a.client.originalBusiness.name > b.client.originalBusiness.name ? 1 : -1,
        ) ?? []
    );
  }, [data]);

  const selectableOpenContracts = useMemo(() => {
    return openContracts.map(entity => ({
      value: entity.id,
      label: entity.client.originalBusiness.name,
    }));
  }, [openContracts]);

  return {
    fetching,
    refresh: () => fetch(),
    openContracts,
    selectableOpenContracts,
  };
};
