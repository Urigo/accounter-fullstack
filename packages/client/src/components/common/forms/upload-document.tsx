import { ReactElement, useCallback, useState } from 'react';
import { FileInput, Loader } from '@mantine/core';
import { useUploadDocument } from '../../../hooks/use-upload-document.js';

type Props = {
  chargeId: string;
  closeModal: () => void;
  onChange: () => void;
};

export const UploadDocument = ({ chargeId, closeModal, onChange }: Props): ReactElement => {
  const { fetching, uploadDocument } = useUploadDocument();
  const [value, setValue] = useState<File | null>(null);

  const onSubmit = useCallback(async () => {
    if (!value) return;
    uploadDocument({
      file: value,
      chargeId,
    }).then(() => {
      onChange();
      closeModal();
    });
  }, [uploadDocument, closeModal, onChange, value, chargeId]);

  return (
    <div className="px-5 w-max h-max justify-items-center">
      <FileInput
        icon={fetching && <Loader />}
        value={value}
        onChange={setValue}
        clearable
        label="File Upload"
      />
      <div className="flex justify-center gap-5 mt-5">
        <button
          type="submit"
          className=" text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
          disabled={fetching || !value}
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
