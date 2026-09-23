import { useCallback, useState, type ReactElement } from 'react';
import { useUploadMultipleDocuments } from '../../../hooks/use-upload-multiple-documents.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { Spinner } from '../../ui/spinner.js';

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
      {/*
        Mantine's `FileInput` was a button-styled control holding the File objects itself.
        A native file input cannot be given a value programmatically, so the picked files
        live in state and the element stays uncontrolled — which is all this call site did
        with `value` anyway. `clearable` goes: the native control re-picks in place, and the
        modal closes on submit.
      */}
      <Label htmlFor="upload-documents-file">File Upload</Label>
      <div className="flex items-center gap-2">
        <Input
          id="upload-documents-file"
          type="file"
          multiple
          onChange={event => setValue(event.target.files ? [...event.target.files] : undefined)}
        />
        {uploading && <Spinner className="size-4 shrink-0 text-gray-500" />}
      </div>
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
