import type { ReactElement } from 'react';
import { Drawer } from '@mantine/core';
import { ImageMagnifier } from './image-magnifier.js';

type Props = {
  /** The document image to preview. Nothing is rendered when it is absent. */
  src?: string | URL | null;
  opened: boolean;
  onClose: () => void;
};

/**
 * Right-side preview drawer for a document image, shared by the documents table,
 * the document actions menu and the edit-document form so they stay in sync.
 */
export const DocumentImageDrawer = ({ src, opened, onClose }: Props): ReactElement | null => {
  if (!src) {
    return null;
  }

  return (
    <Drawer
      classNames={{ content: 'overflow-y-auto drop-shadow-lg' }}
      withCloseButton
      withOverlay={false}
      position="right"
      opened={opened}
      onClose={onClose}
      size="30%"
    >
      <div className="m-2">
        <ImageMagnifier
          src={src.toString()}
          zoomLevel={3}
          magnifierHeight={300}
          magnifierWidth={300}
        />
      </div>
    </Drawer>
  );
};
