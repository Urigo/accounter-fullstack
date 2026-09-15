import { useCallback, useState, type ReactElement } from 'react';
import { useUploadPayrollFile } from '../../../hooks/use-upload-payroll-file.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { Spinner } from '../../ui/spinner.js';

type Props = {
  chargeId: string;
  onDone: () => void;
};

export const UploadPayrollFile = ({ chargeId, onDone }: Props): ReactElement => {
  const { fetching, uploadPayrollFile } = useUploadPayrollFile();
  const [value, setValue] = useState<File | null>(null);

  const onSubmit = useCallback(async () => {
    if (!value) return;
    uploadPayrollFile({
      file: value,
      chargeId,
    }).then(onDone);
  }, [uploadPayrollFile, onDone, value, chargeId]);

  return (
    <div className="px-5 w-max h-max justify-items-center">
      {/* Same swap as upload-documents.tsx: a native file input cannot take a value, so the
          picked file lives in state and `clearable` is dropped. */}
      <Label htmlFor="upload-payroll-file">File Upload</Label>
      <div className="flex items-center gap-2">
        <Input
          id="upload-payroll-file"
          type="file"
          onChange={event => setValue(event.target.files?.[0] ?? null)}
        />
        {fetching && <Spinner className="size-4 shrink-0 text-gray-500" />}
      </div>
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
