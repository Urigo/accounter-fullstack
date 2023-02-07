import { PopUpDrawer, UploadDocument } from '..';

interface Props {
  uploadDocument: string;
  setUploadDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const UploadDocumentModal = ({ uploadDocument, setUploadDocument }: Props) => {
  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Upload Document:</h1>
          <a href="/#" className="pt-1">
            Charge ID: {uploadDocument}
          </a>
        </div>
      }
      opened={Boolean(uploadDocument)}
      onClose={() => setUploadDocument(undefined)}
    >
      <UploadDocument chargeId={uploadDocument} closeModal={() => setUploadDocument(undefined)} />
    </PopUpDrawer>
  );
};
