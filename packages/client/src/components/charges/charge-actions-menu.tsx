import { useCallback, useState, type ReactElement } from 'react';
import { ArrowDownWideNarrow, Edit, FilePlus2, ListPlus, MoreVertical, Trash } from 'lucide-react';
import { Modal } from '@mantine/core';
import type { ChargeType } from '@/helpers/index.js';
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
  isIncome: boolean;
}

export function ChargeActionsMenu({
  chargeId,
  chargeType,
  onChange,
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

  const onDelete = useCallback(async (): Promise<void> => {
    await deleteCharge({
      chargeId,
    });
    onChange?.();
  }, [chargeId, deleteCharge, onChange]);

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
          <DropdownMenuLabel>Charge</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setEditingCharge(true)}>
            <Edit className="size-4" />
            Edit Charge
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmDeleteOpen(true)}>
            <Trash className="size-4" />
            Delete Charge
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Documents</DropdownMenuLabel>

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

          <DropdownMenuLabel>Misc Expenses</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setMiscExpensesOpened(true)}>
            <ListPlus className="size-4" />
            Add expense
          </DropdownMenuItem>
          {chargeType === 'CommonCharge' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Depreciation</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDepreciationOpened(true)}>
                <ArrowDownWideNarrow className="size-4" />
                Depreciation
              </DropdownMenuItem>
            </>
          )}
          {chargeType === 'SalaryCharge' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Salaries</DropdownMenuLabel>
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
        onConfirm={onDelete}
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
        onDone={() => onChange?.()}
      />
      <EditChargeModal
        chargeId={editingCharge ? chargeId : undefined}
        close={() => setEditingCharge(false)}
        onChange={() => {
          setEditingCharge(false);
          onChange?.();
        }}
      />
      <InsertDocumentModal
        chargeId={insertingDocument ? chargeId : undefined}
        onChange={onChange}
        close={() => setInsertingDocument(false)}
      />
    </>
  );
}
