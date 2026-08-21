import { useCallback, useState, type ReactElement } from 'react';
import {
  ArrowDownWideNarrow,
  Edit,
  FilePlus2,
  Link,
  ListPlus,
  MoreVertical,
  Trash,
} from 'lucide-react';
import { Modal } from '@mantine/core';
import type { ChargeType } from '@/helpers/index.js';
import { ROUTES } from '@/router/routes.js';
import { writeToClipboard } from '../../helpers/index.js';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import { Depreciation } from '../common/depreciation/index.js';
import {
  ConfirmationModal,
  EditChargeModal,
  InsertDocumentModal,
  InsertMiscExpense,
  PreviewDocumentModal,
  UploadDocumentsModal,
  UploadPayrollFile,
} from '../common/index.js';
import { Button } from '../ui/button.js';
import { Dialog, DialogContent } from '../ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

interface ChargeActionsMenuProps {
  chargeId: string;
  chargeType: ChargeType;
  onChange?: () => void;
  /**
   * Called after the charge was successfully deleted. Hosts that list charges should use it to drop
   * the charge from their list — falling back to `onChange` would refetch a charge that no longer
   * exists.
   */
  onDelete?: () => void;
  isIncome: boolean;
}

export function ChargeActionsMenu({
  chargeId,
  chargeType,
  onChange,
  onDelete,
  isIncome,
}: ChargeActionsMenuProps): ReactElement {
  const { deleteCharge } = useDeleteCharge();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [depreciationOpened, setDepreciationOpened] = useState(false);
  const closeDepreciation = useCallback((): void => setDepreciationOpened(false), []);
  const [miscExpensesOpened, setMiscExpensesOpened] = useState(false);
  const [uploadSalariesOpened, setUploadSalariesOpened] = useState(false);
  const closeUploadSalaries = useCallback((): void => setUploadSalariesOpened(false), []);
  const [previewIssueDocument, setPreviewIssueDocument] = useState(false);
  const [editingCharge, setEditingCharge] = useState(false);
  const [insertingDocument, setInsertingDocument] = useState(false);

  const [uploadDocumentsOpen, setUploadDocumentsOpen] = useState(false);

  const onCopyLink = useCallback((): void => {
    writeToClipboard(`${window.location.origin}${ROUTES.CHARGES.DETAIL(chargeId)}`);
  }, [chargeId]);

  const handleDelete = useCallback(async (): Promise<void> => {
    const deleted = await deleteCharge({
      chargeId,
    });
    if (deleted && onDelete) {
      // The charge is gone — let the host remove it rather than refetch it.
      onDelete();
      return;
    }
    onChange?.();
  }, [chargeId, deleteCharge, onChange, onDelete]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Charge actions"
            onClick={event => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-50"
          onClick={event => event.stopPropagation()}
        >
          <DropdownMenuLabel variant="section">Charge</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setEditingCharge(true)}>
            <Edit className="size-4" />
            Edit Charge
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyLink}>
            <Link className="size-4" />
            Copy Charge Link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmDeleteOpen(true)}>
            <Trash className="size-4" />
            Delete Charge
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel variant="section">Documents</DropdownMenuLabel>

          <DropdownMenuItem onSelect={() => setInsertingDocument(true)}>
            <ListPlus className="size-4" />
            Insert Document
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setUploadDocumentsOpen(true)}>
            <FilePlus2 className="size-4" />
            Upload Documents
          </DropdownMenuItem>
          {isIncome && (
            <DropdownMenuItem onSelect={() => setPreviewIssueDocument(true)}>
              <ListPlus className="size-4" />
              Issue Document
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuLabel variant="section">Misc Expenses</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setMiscExpensesOpened(true)}>
            <ListPlus className="size-4" />
            Add expense
          </DropdownMenuItem>
          {chargeType === 'CommonCharge' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel variant="section">Depreciation</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDepreciationOpened(true)}>
                <ArrowDownWideNarrow className="size-4" />
                Depreciation
              </DropdownMenuItem>
            </>
          )}
          {chargeType === 'SalaryCharge' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel variant="section">Salaries</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setUploadSalariesOpened(true)}>
                <FilePlus2 className="size-4" />
                Payroll file upload
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmationModal
        open={confirmDeleteOpen}
        setOpen={setConfirmDeleteOpen}
        onConfirm={handleDelete}
        title="Are you sure you want to delete this charge?"
      />
      <Modal
        withinPortal
        size="xl"
        centered
        opened={depreciationOpened}
        onClose={closeDepreciation}
        title="Depreciation"
        onClick={event => event.stopPropagation()}
      >
        <Depreciation
          chargeId={chargeId}
          onChange={() => {
            closeDepreciation();
            onChange?.();
          }}
        />
      </Modal>
      <Dialog open={miscExpensesOpened} onOpenChange={setMiscExpensesOpened}>
        <DialogContent className="sm:max-w-[425px]" onClick={event => event.stopPropagation()}>
          <InsertMiscExpense
            onDone={() => {
              setMiscExpensesOpened(false);
              onChange?.();
            }}
            chargeId={chargeId}
          />
        </DialogContent>
      </Dialog>
      <Modal
        centered
        opened={uploadSalariesOpened}
        onClose={closeUploadSalaries}
        title="Upload Payroll File"
        onClick={event => event.stopPropagation()}
      >
        <UploadPayrollFile
          onDone={() => {
            closeUploadSalaries();
            onChange?.();
          }}
          chargeId={chargeId}
        />
      </Modal>
      <UploadDocumentsModal
        open={uploadDocumentsOpen}
        onOpenChange={setUploadDocumentsOpen}
        onChange={onChange}
        chargeId={chargeId}
      />
      <PreviewDocumentModal
        chargeId={chargeId}
        open={previewIssueDocument}
        setOpen={setPreviewIssueDocument}
        onIssued={() => onChange?.()}
      />
      <EditChargeModal
        chargeId={editingCharge ? chargeId : undefined}
        close={() => setEditingCharge(false)}
        onChange={onChange}
      />
      <InsertDocumentModal
        chargeId={insertingDocument ? chargeId : undefined}
        onChange={onChange}
        close={() => setInsertingDocument(false)}
      />
    </>
  );
}
