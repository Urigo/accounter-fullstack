import type { ReactElement } from 'react';
import { useQuery } from 'urql';
import { Loader } from '@mantine/core';
import { ROUTES } from '@/router/routes.js';
import { EditChargeDocument } from '../../../gql/graphql.js';
import { CopyToClipboardButton, EditCharge, PopUpDrawer } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditCharge($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      counterparty {
        id
        name
      }
      owner {
        id
        name
      }
      property
      conversion
      isInvoicePaymentDifferentCurrency
      userDescription
      taxCategory {
        id
        name
      }
      tags {
        id
      }
      missingInfoSuggestions {
        ... on ChargeSuggestions {
          tags {
            id
          }
        }
      }
      optionalVAT
      optionalDocuments
      ... on BusinessTripCharge {
        businessTrip {
          id
          name
        }
      }
      yearsOfRelevance {
        year
        amount
      }
    }
  }
`;

interface Props {
  chargeId?: string;
  close: () => void;
  onChange?: () => void;
}

export const EditChargeModal = ({ chargeId, close, onChange }: Props): ReactElement | null => {
  return chargeId ? (
    <EditChargeModalContent chargeId={chargeId} close={close} onChange={onChange} />
  ) : null;
};

export const EditChargeModalContent = ({
  chargeId,
  close,
  onChange = (): void => {},
}: Omit<Props, 'chargeId'> & { chargeId: string }): ReactElement => {
  const [{ data: chargeData, fetching: fetchingCharge }] = useQuery({
    query: EditChargeDocument,
    variables: {
      chargeId,
    },
  });

  const charge = chargeData?.charge;

  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
          <div className="flex flex-row gap-2">
            ID: {chargeId}
            <CopyToClipboardButton
              isLink
              content={`${window.location.origin}${ROUTES.CHARGES.DETAIL(chargeId)}`}
            />
          </div>
        </div>
      }
      opened={!!chargeId}
      onClose={close}
    >
      {fetchingCharge || !charge ? (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      ) : (
        <EditCharge charge={charge} close={close} onChange={onChange} />
      )}
    </PopUpDrawer>
  );
};
