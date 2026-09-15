import { useState, type ReactElement } from 'react';
import { ImageOff } from 'lucide-react';
import { DocumentImageDrawer } from '../../common/index.js';
import type { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

function toHref(value?: string | URL | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return typeof value === 'string' ? value : value.href;
}

/**
 * Inline thumbnail of the document's stored image.
 *
 * Off by default: it costs one image request per visible row, which is real weight on a table that
 * routinely lists hundreds of documents. It earns that cost when someone is working through a
 * backlog and needs to recognise documents at a glance rather than open them one by one.
 */
export const Preview = ({ document }: Props): ReactElement => {
  const [openImage, setOpenImage] = useState(false);
  const src = toHref(document.image);

  if (!src) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed text-muted-foreground">
        <ImageOff className="size-4" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="block h-16 w-16 overflow-hidden rounded border hover:ring-2 hover:ring-ring"
        onClick={() => setOpenImage(true)}
        aria-label="Open document image"
      >
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      </button>
      <DocumentImageDrawer
        src={document.image}
        opened={openImage}
        onClose={(): void => setOpenImage(false)}
      />
    </>
  );
};
