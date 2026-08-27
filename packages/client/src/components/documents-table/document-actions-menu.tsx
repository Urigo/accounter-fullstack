import { useCallback, useState, type ReactElement } from 'react';
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
  Trash,
  Unlink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import { DocumentType } from '../../gql/graphql.js';
import { writeToClipboard } from '../../helpers/index.js';
import {
  CloseDocumentButton,
  DeleteDocumentButton,
  DocumentImageDrawer,
  PreviewDocumentModal,
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
   * Show the items that navigate away to the document's charge. Hosts that already live inside a
   * charge (the charge screen's documents accordion, for instance) leave it off.
   */
  withChargeLink?: boolean;
}

function toHref(value?: string | URL | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return typeof value === 'string' ? value : value.href;
}

export function DocumentActionsMenu({
  document,
  withChargeLink = false,
}: DocumentActionsMenuProps): ReactElement {
  const [imageOpen, setImageOpen] = useState(false);
  const [closeDocumentOpen, setCloseDocumentOpen] = useState(false);
  const [issueDocumentOpen, setIssueDocumentOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const chargeId = document.charge?.id;
  const fileHref = toHref(document.file);
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
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
          <DropdownMenuItem onSelect={document.editDocument}>
            <Edit className="size-4" />
            Edit Document
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyDocumentId}>
            <Copy className="size-4" />
            Copy Document ID
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel variant="section">Files</DropdownMenuLabel>
          <DropdownMenuItem disabled={!document.image} onSelect={() => setImageOpen(true)}>
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

      <DocumentImageDrawer
        src={document.image}
        opened={imageOpen}
        onClose={(): void => setImageOpen(false)}
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
