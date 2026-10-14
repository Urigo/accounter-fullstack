import { useState, type ReactElement } from 'react';
import { File, Image } from 'lucide-react';
import {
  hasViewerAttachment,
  isSafeHttpUrl,
  toDocumentViewerEntry,
} from '../../common/document-viewer/source.js';
import { DocumentImageDrawer, SimpleGrid, Tooltip } from '../../common/index.js';
import { Button } from '../../ui/button.js';
import { Indicator } from '../../ui/indicator.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Files = ({ document }: Props): ReactElement => {
  const [openImage, setOpenImage] = useState<boolean>(false);
  const source = toDocumentViewerEntry(document);
  const image = source.imageUrl;
  // `file` is user-editable and may hold any scheme; only an http(s) URL becomes a link.
  const fileHref = isSafeHttpUrl(source.fileUrl) ? source.fileUrl : null;

  return (
    <>
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
                  onClick={(): void => setOpenImage(!!image)}
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
      <DocumentImageDrawer
        source={hasViewerAttachment(source) ? source : null}
        opened={openImage}
        onClose={(): void => setOpenImage(false)}
      />
    </>
  );
};
