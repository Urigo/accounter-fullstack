import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { EditCharge, PopUpDrawer } from '..';
import { FragmentType, getFragmentData } from '../../../gql';
import { EditChargeFieldsFragment, EditChargeFieldsFragmentDoc } from '../../../gql/graphql';
import { writeToClipboard } from '../../../helpers';

interface Props {
  editCharge: FragmentType<typeof EditChargeFieldsFragmentDoc>;
  setEditCharge: React.Dispatch<
    React.SetStateAction<
      | {
          ' $fragmentRefs'?:
            | {
                EditChargeFieldsFragment: EditChargeFieldsFragment;
              }
            | undefined;
        }
      | undefined
    >
  >;
}

export const EditChargeModal = ({ editCharge, setEditCharge }: Props) => {
  const chargeId = getFragmentData(EditChargeFieldsFragmentDoc, editCharge).id;

  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
          <div className="flex flex-row gap-2">
            ID: {chargeId}
            <ActionIcon variant="default" onClick={() => writeToClipboard(chargeId)} size={30}>
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!editCharge}
      onClose={() => setEditCharge(undefined)}
    >
      <EditCharge
        chargeProps={editCharge}
        onAccept={() => setEditCharge(undefined)}
        onCancel={() => setEditCharge(undefined)}
      />
    </PopUpDrawer>
  );
};
