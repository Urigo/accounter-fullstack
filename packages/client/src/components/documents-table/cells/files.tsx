import type { ReactElement } from 'react';
import { File, Image } from 'lucide-react';
import { useDocumentViewer } from '@/hooks/use-document-viewer.js';
import type { AnyTable } from '@/lib/table-features.js';
import { buildViewerSiblings } from '../../common/document-viewer/siblings.js';
import { isSafeHttpUrl, toDocumentViewerEntry } from '../../common/document-viewer/source.js';
import { SimpleGrid, Tooltip } from '../../common/index.js';
import { Button } from '../../ui/button.js';
import { Indicator } from '../../ui/indicator.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
  /** The table this cell sits in; the viewer steps through its rows. Either feature set. */
  table?: AnyTable<DocumentsTableRowType>;
};

export const Files = ({ document, table }: Props): ReactElement => {
  const isActive = useDocumentViewer(s => s.current?.id === document.id);
  const toggle = useDocumentViewer(s => s.toggle);
  const source = toDocumentViewerEntry(document);
  const image = source.imageUrl;
  // `file` is user-editable and may hold any scheme; only an http(s) URL becomes a link.
  const fileHref = isSafeHttpUrl(source.fileUrl) ? source.fileUrl : null;

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">
        <SimpleGrid cols={1}>
          <Tooltip disabled={!image} content="Open Image">
            <Indicator inline size={12} disabled={!!image} color="red">
              <Button
                variant="ghost"
                size="icon"
                className="size-7.5"
                disabled={!image}
                // Matches the tooltip, and differs from the Preview thumbnail's name so the two
                // buttons in one row are told apart by screen-reader users.
                aria-label="Open image"
                aria-expanded={isActive}
                // Opens the shared viewer, or closes it when this document is the one shown.
                onClick={e =>
                  toggle(source, {
                    trigger: e.currentTarget,
                    siblings: table ? buildViewerSiblings(table) : null,
                  })
                }
              >
                <Image className="size-5" />
              </Button>
            </Indicator>
          </Tooltip>
          <Tooltip disabled={!fileHref} content="Open File">
            <Indicator inline size={12} disabled={!!source.fileUrl} color="red">
              {fileHref ? (
                <a href={fileHref} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="icon" className="size-7.5">
                    <File className="size-5" />
                  </Button>
                </a>
              ) : (
                <Button variant="ghost" size="icon" className="size-7.5" disabled>
                  <File className="size-5" />
                </Button>
              )}
            </Indicator>
          </Tooltip>
        </SimpleGrid>
      </div>
    </div>
  );
};
