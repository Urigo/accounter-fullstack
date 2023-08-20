import { ReactElement } from 'react';
import { Copy } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Loader } from '@mantine/core';
import { EditCharge, PopUpDrawer } from '..';
import { EditChargeDocument } from '../../../gql/graphql';
import { writeToClipboard } from '../../../helpers';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditCharge($chargeIDs: [ID!]!) {
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
      userDescription
      taxCategory {
        id
        name
      }
      tags {
        name
      }
    }
  }
`;

interface Props {
  chargeId?: string;
  onDone: () => void;
}

export const EditChargeModal = ({ chargeId, onDone }: Props): ReactElement | null => {
  return chargeId ? <EditChargeModalContent chargeId={chargeId} onDone={onDone} /> : null;
};

export const EditChargeModalContent = ({
  chargeId,
  onDone,
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
      onClose={onDone}
    >
      {fetchingCharge || !charge ? (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      ) : (
        <EditCharge charge={charge} onDone={onDone} />
      )}
    </PopUpDrawer>
  );
};
