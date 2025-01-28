import { ReactElement, useCallback, useState } from 'react';
import { FileInput, Loader } from '@mantine/core';
import { useUploadPayrollFile } from '../../../hooks/use-upload-payroll-file.js';

type Props = {
  chargeId: string;
  onDone: () => void;
};

export const UploadPayrollFile = ({ chargeId, onDone }: Props): ReactElement => {
  const { fetching, uploadPayrollFile } = useUploadPayrollFile();
  const [value, setValue] = useState<File | null>(null);

  const onSubmit = useCallback(async () => {
    uploadPayrollFile({
      file: value,
      chargeId,
    }).then(onDone);
  }, [uploadPayrollFile, onDone, value, chargeId]);

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
      </div>
    </div>
  );
};
