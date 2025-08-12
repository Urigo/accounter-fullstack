import type { ReactElement } from 'react';
import { toast } from 'sonner';
import { Dropzone } from '@mantine/dropzone';
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

  return (
    <Dropzone
      onDrop={documents => uploadMultipleDocuments({ documents, chargeId, isSensitive: false })}
      onReject={(files): void =>
        onFail(
          `Rejected Files:\n${files.map(file => `"${file.file.name}": ${file.errors}`).join('\n')}`,
        )
      }
      activateOnClick={false}
      activateOnKeyboard={false}
      radius={0}
      padding={0}
      maxFiles={Infinity}
      loading={uploading}
      sx={() => ({
        border: 0,
        cursor: 'default',
        width: '100%',
        height: '100%',
        zIndex: 1,
      })}
    >
      {children}
    </Dropzone>
  );
};
