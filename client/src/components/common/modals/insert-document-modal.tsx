import { InsertDocument, PopUpDrawer } from '..';

interface Props {
  insertDocument: string;
  setInsertDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const InsertDocumentModal = ({ insertDocument, setInsertDocument }: Props) => {
  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Insert Document:</h1>
          <a href="/#" className="pt-1">
            Charge ID: {insertDocument}
          </a>
        </div>
      }
      opened={!!insertDocument}
      onClose={() => setInsertDocument(undefined)}
    >
      <InsertDocument chargeId={insertDocument} closeModal={() => setInsertDocument(undefined)} />
    </PopUpDrawer>
  );
};
