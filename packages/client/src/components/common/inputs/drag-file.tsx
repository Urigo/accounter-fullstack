import type { ReactElement } from 'react';
import { toast } from 'sonner';
import { useUploadMultipleDocuments } from '../../../hooks/use-upload-multiple-documents.js';

type Props = {
  children?: ReactElement | ReactElement[];
  chargeId: string;
};

export const DragFile = ({ children, chargeId }: Props): ReactElement => {
  const { uploading, uploadMultipleDocuments } = useUploadMultipleDocuments();

  function onFail(description: string): void {
    toast.error('Error', {
      description,
      duration: 5000,
    });
  }

  // Mantine's `Dropzone` with `activateOnClick`/`activateOnKeyboard` off, zero radius,
  // zero padding and `border: 0` is a bare drop target wrapping its children — which is
  // what the native drag-and-drop events give directly. `loading` only dimmed it, so the
  // in-flight state is a pointer-events guard plus reduced opacity.
  return (
    <div
      className={uploading ? 'pointer-events-none h-full w-full opacity-60' : 'h-full w-full'}
      onDragOver={(event): void => event.preventDefault()}
      onDrop={(event): void => {
        event.preventDefault();
        const documents = [...event.dataTransfer.files];
        if (documents.length === 0) {
          onFail('No files found in the drop');
          return;
        }
        uploadMultipleDocuments({ documents, chargeId, isSensitive: false });
      }}
    >
      {children}
    </div>
  );
};
