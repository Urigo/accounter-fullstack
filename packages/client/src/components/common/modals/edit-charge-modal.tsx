import { ReactElement } from 'react';
import { Copy } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Loader } from '@mantine/core';
import { EditChargeDocument } from '../../../gql/graphql.js';
import { writeToClipboard } from '../../../helpers/index.js';
import { EditCharge, PopUpDrawer } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditCharge($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
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
      optionalVAT
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
      chargeIDs: [chargeId],
    },
  });

  const charge = chargeData?.chargesByIDs?.[0];

  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
          <div className="flex flex-row gap-2">
            ID: {chargeId}
            <ActionIcon
              variant="default"
              onClick={(): void => writeToClipboard(chargeId)}
              size={30}
            >
              <Copy size={20} />
            </ActionIcon>
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
