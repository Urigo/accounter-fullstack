import { useCallback, useState, type ComponentProps, type ReactElement } from 'react';
import { CircleX } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { useCloseDocument } from '../../../hooks/use-close-document.js';
import { Button } from '../../ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { ConfirmationModal, PreviewDocumentModal } from '../index.js';

export function CloseDocumentButton(
  props: ComponentProps<typeof Button> & {
    documentId: string;
    couldIssueCreditInvoice: boolean;
  },
): ReactElement {
  const { closeDocument } = useCloseDocument();
  const [open, setOpen] = useState(false);
  const [previewCreditInvoice, setPreviewCreditInvoice] = useState(false);

  const onFinallyClose = useCallback(() => {
    closeDocument({ documentId: props.documentId });
  }, [closeDocument, props.documentId]);

  if (!props.couldIssueCreditInvoice) {
    return (
      <ConfirmationModal
        onConfirm={onFinallyClose}
        title="Are you sure you want to close this document?"
      >
        <Button className="size-7.5 text-red-600" variant="ghost" {...props}>
          <CircleX className="size-5" />
        </Button>
      </ConfirmationModal>
    );
  }

  return (
    <>
      <Tooltip label="Close Document">
        <Button
          className="size-7.5 text-red-600"
          variant="ghost"
          {...props}
          onClick={() => setOpen(true)}
        >
          <CircleX className="size-5" />
        </Button>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Should Issue Credit Invoice?</DialogTitle>
          </DialogHeader>

          <DialogFooter>
            <Button
              onClick={() => {
                setOpen(false);
                onFinallyClose();
              }}
              variant="secondary"
            >
              Just Close
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setPreviewCreditInvoice(true);
              }}
              variant="default"
            >
              Issue Credit Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PreviewDocumentModal
        documentId={props.documentId}
        documentType={DocumentType.CreditInvoice}
        open={previewCreditInvoice}
        setOpen={setPreviewCreditInvoice}
      />
    </>
  );
}
