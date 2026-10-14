import type { ReactElement } from 'react';
import { DocumentViewer } from './document-viewer/document-viewer.js';
import type { DocumentViewerEntry } from './document-viewer/types.js';
import { PopUpDrawer } from './modals/drawer.js';

type Props = {
  /** The document to show; `null` when it has neither an image nor a file. */
  source: DocumentViewerEntry | null;
  opened: boolean;
  onClose: () => void;
};

/**
 * Right-side drawer around the document viewer, shared by the documents table, the document actions
 * menu and the edit-document form so they stay in sync. Half the viewport wide from `sm` up, so a
 * scan is readable without the magnifier.
 */
export const DocumentImageDrawer = ({ source, opened, onClose }: Props): ReactElement | null => {
  if (!source) {
    return null;
  }

  return (
    <PopUpDrawer
      size="document"
      withHeader={false}
      accessibleTitle={source.title}
      withOverlay={false}
      position="right"
      opened={opened}
      onClose={onClose}
    >
      <DocumentViewer
        source={source}
        // A new image URL (an edit saved in the sheet) restarts the canvas, as a new document does.
        documentKey={`${source.id}:${source.imageUrl ?? ''}`}
        onClose={onClose}
      />
    </PopUpDrawer>
  );
};
