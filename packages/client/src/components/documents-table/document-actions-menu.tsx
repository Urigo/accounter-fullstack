import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  CircleX,
  Copy,
  Edit,
  ExternalLink,
  File,
  Image,
  Link as LinkIcon,
  ListPlus,
  MoreVertical,
  ScanText,
  Trash,
  Unlink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocumentViewer } from '@/hooks/use-document-viewer.js';
import type { AnyTable } from '@/lib/table-features.js';
import { ROUTES } from '@/router/routes.js';
import { DocumentType } from '../../gql/graphql.js';
import { writeToClipboard } from '../../helpers/index.js';
import { buildViewerSiblings, getRowIds } from '../common/document-viewer/siblings.js';
import {
  isSafeHttpUrl,
  toDocumentViewerEntry,
  toUrlString,
} from '../common/document-viewer/source.js';
import {
  CloseDocumentButton,
  DeleteDocumentButton,
  PreviewDocumentModal,
  ReprocessDocumentOcrButton,
  UnlinkDocumentButton,
} from '../common/index.js';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';
import type { DocumentsTableRowType } from './columns.js';

interface DocumentActionsMenuProps {
  document: DocumentsTableRowType;
  /**
   * The table this menu sits in, from either feature set: View Image steps through its rows, and
   * Edit Document hands their ids to Save & next.
   */
  table?: AnyTable<DocumentsTableRowType>;
  /**
   * Show the items that navigate away to the document's charge. Hosts that already live inside a
   * charge (the charge screen's documents accordion, for instance) leave it off.
   */
  withChargeLink?: boolean;
}

export function DocumentActionsMenu({
  document,
  table,
  withChargeLink = false,
}: DocumentActionsMenuProps): ReactElement {
  // The menu item is portaled to `document.body`, so the trigger button stands in for it when the
  // viewer checks whether it was opened from inside a dialog.
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const isViewing = useDocumentViewer(s => s.current?.id === document.id);
  const openViewer = useDocumentViewer(s => s.open);
  const updateViewer = useDocumentViewer(s => s.update);
  const viewerEntry = useMemo(() => toDocumentViewerEntry(document), [document]);
  const [closeDocumentOpen, setCloseDocumentOpen] = useState(false);
  const [issueDocumentOpen, setIssueDocumentOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reprocessOcrOpen, setReprocessOcrOpen] = useState(false);

  const chargeId = document.charge?.id;
  // `file` is user-editable and may hold any scheme; only an http(s) URL becomes a link.
  const fileUrl = toUrlString(document.file);
  const fileHref = isSafeHttpUrl(fileUrl) ? fileUrl : undefined;
  const isOpenIssuedDocument =
    'issuedDocumentInfo' in document && document.issuedDocumentInfo?.status === 'OPEN';

  const onCopyChargeLink = useCallback((): void => {
    if (chargeId) {
      writeToClipboard(`${window.location.origin}${ROUTES.CHARGES.DETAIL(chargeId)}`);
    }
  }, [chargeId]);

  const onCopyDocumentId = useCallback((): void => {
    writeToClipboard(document.id);
  }, [document.id]);

  // The actions column can't be hidden, so this cell keeps the open viewer in step with the row:
  // an edit saved in the sheet refreshes the docked document. `update` ignores unchanged entries.
  useEffect(() => {
    if (isViewing) {
      updateViewer(viewerEntry);
    }
  }, [isViewing, viewerEntry, updateViewer]);

  // A deleted document must not stay in the viewer. Done on delete success, not on unmount: a
  // refetch remounts rows, and the row usually unmounts before the delete resolves anyway.
  const onDocumentDeleted = useCallback((): void => {
    const viewer = useDocumentViewer.getState();
    if (viewer.current?.id === document.id) {
      viewer.close();
    }
  }, [document.id]);

  return (
    <>
      {/* Non-modal: a modal menu sets `pointer-events: none` on <body>, and the edit-document / image
          drawers (vaul) mount while it is still set. Their Radix layer saves that value and puts it
          back on close, which leaves the whole page unclickable. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            variant="ghost"
            size="icon"
            aria-label="Document actions"
            onClick={event => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-56"
          onClick={event => event.stopPropagation()}
        >
          <DropdownMenuLabel variant="section">Document</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => document.editDocument(table ? getRowIds(table) : undefined)}
          >
            <Edit className="size-4" />
            Edit Document
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyDocumentId}>
            <Copy className="size-4" />
            Copy Document ID
          </DropdownMenuItem>
          {/* Nothing records whether OCR ever ran, so the only precondition that can be checked
              here is that there is still a file to read back. */}
          <DropdownMenuItem
            disabled={!document.file && !document.image}
            onSelect={() => setReprocessOcrOpen(true)}
          >
            <ScanText className="size-4" />
            Re-run OCR
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel variant="section">Files</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!document.image}
            onSelect={() =>
              openViewer(viewerEntry, {
                trigger: menuTriggerRef.current,
                siblings: table ? buildViewerSiblings(table) : null,
              })
            }
          >
            <Image className="size-4" />
            View Image
          </DropdownMenuItem>
          {fileHref ? (
            <DropdownMenuItem asChild>
              <a href={fileHref} target="_blank" rel="noreferrer">
                <File className="size-4" />
                Open File
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <File className="size-4" />
              Open File
            </DropdownMenuItem>
          )}

          {withChargeLink && chargeId && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuLabel variant="section">Charge</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to={ROUTES.CHARGES.DETAIL(chargeId)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open Charge
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCopyChargeLink}>
                <LinkIcon className="size-4" />
                Copy Charge Link
              </DropdownMenuItem>
            </>
          )}

          {isOpenIssuedDocument && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuLabel variant="section">Issued Document</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setCloseDocumentOpen(true)}>
                <CircleX className="size-4" />
                Close Document
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIssueDocumentOpen(true)}>
                <ListPlus className="size-4" />
                Issue Document out of This Document
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={!chargeId} onSelect={() => setUnlinkOpen(true)}>
            <Unlink className="size-4" />
            Unlink Document
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash className="size-4" />
            Delete Document
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReprocessDocumentOcrButton
        documentId={document.id}
        onChange={document.onUpdate}
        open={reprocessOcrOpen}
        setOpen={setReprocessOcrOpen}
      />

      <UnlinkDocumentButton
        documentId={document.id}
        onChange={document.onUpdate}
        onChargeDeleted={document.onChargeDeleted}
        open={unlinkOpen}
        setOpen={setUnlinkOpen}
      />
      <DeleteDocumentButton
        documentId={document.id}
        onChange={document.onUpdate}
        onDone={onDocumentDeleted}
        onChargeDeleted={document.onChargeDeleted}
        open={deleteOpen}
        setOpen={setDeleteOpen}
      />

      {isOpenIssuedDocument && (
        <>
          <CloseDocumentButton
            documentId={document.id}
            couldIssueCreditInvoice={
              document.documentType === DocumentType.Invoice ||
              document.documentType === DocumentType.InvoiceReceipt
            }
            onChange={document.onUpdate}
            open={closeDocumentOpen}
            setOpen={setCloseDocumentOpen}
          />
          <PreviewDocumentModal
            documentId={document.id}
            open={issueDocumentOpen}
            setOpen={setIssueDocumentOpen}
            onIssued={document.onUpdate}
          />
        </>
      )}
    </>
  );
}
