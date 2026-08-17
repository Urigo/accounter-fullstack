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
      // Mantine puts `pointer-events: none` on its inner wrapper so the root can capture the click
      // that opens a file dialog. With `activateOnClick={false}` there is no such click to capture,
      // and the side effect is that nothing inside the dropzone is interactive — which went unnoticed
      // while this only ever wrapped inert count text. It now wraps a whole charge record, whose
      // checkbox, menus, links and expand button all need to be clickable. Drop detection is
      // unaffected: it rides on the root's drag events.
      styles={{ inner: { pointerEvents: 'auto' } }}
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
