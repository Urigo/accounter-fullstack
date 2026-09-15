import type { ReactElement } from 'react';
import { ImageMagnifier } from './image-magnifier.js';
import { PopUpDrawer } from './modals/drawer.js';

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
    // `size="30%"` does not carry over: PopUpDrawer's content is the house width
    // (`w-3/4 sm:max-w-sm`), which is narrower than 30% of a wide viewport.
    <PopUpDrawer
      withCloseButton
      withOverlay={false}
      position="right"
      opened={opened}
      onClose={onClose}
    >
      <div className="m-2">
        <ImageMagnifier
          src={src.toString()}
          zoomLevel={3}
          magnifierHeight={300}
          magnifierWidth={300}
        />
      </div>
    </PopUpDrawer>
  );
};
