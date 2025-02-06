import { ReactElement, useCallback, useState } from 'react';
import { FileInput, Loader } from '@mantine/core';
import { useUploadMultipleDocuments } from '../../../hooks/use-upload-multiple-documents.js';

type Props = {
  chargeId: string;
  closeModal: () => void;
  onChange: () => void;
};

export const UploadDocuments = ({ chargeId, closeModal, onChange }: Props): ReactElement => {
  const { uploading, uploadMultipleDocuments } = useUploadMultipleDocuments();
  const [value, setValue] = useState<File[] | undefined>(undefined);

  const onSubmit = useCallback(async () => {
    if (!value) return;
    uploadMultipleDocuments({
      documents: value,
      chargeId,
    }).then(() => {
      onChange();
      closeModal();
    });
  }, [uploadMultipleDocuments, closeModal, onChange, value, chargeId]);

  return (
    <div className="px-5 w-max h-max justify-items-center">
      <FileInput
        icon={uploading && <Loader />}
        value={value}
        multiple
        onChange={setValue}
        clearable
        label="File Upload"
      />
      <div className="flex justify-center gap-5 mt-5">
        <button
          type="submit"
          className=" text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
          disabled={uploading || !value}
          onClick={onSubmit}
        >
          Accept
        </button>
        <button
          type="button"
          className=" text-white bg-rose-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-rose-600 rounded-sm text-lg"
          onClick={closeModal}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
