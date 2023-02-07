import { FragmentType, getFragmentData } from '../../../gql';
import { EditChargeFieldsFragment, EditChargeFieldsFragmentDoc } from '../../../gql/graphql';
import { EditCharge, PopUpDrawer } from '..';

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
  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
          <a href="/#" className="pt-1">
            ID: {getFragmentData(EditChargeFieldsFragmentDoc, editCharge).id}
          </a>
        </div>
      }
      opened={Boolean(editCharge)}
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
