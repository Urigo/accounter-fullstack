import { useState, type ReactElement } from 'react';
import { ArrowDownWideNarrow, FilePlus2, ListPlus, Search, Trash } from 'lucide-react';
import { Burger, Menu, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ChargesTableRowFieldsFragment } from '../../gql/graphql.js';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import { Depreciation } from '../common/depreciation/index.js';
import {
  ConfirmationModal,
  InsertMiscExpense,
  UploadDocumentsModal,
  UploadPayrollFile,
} from '../common/index.js';
import { Dialog, DialogContent } from '../ui/dialog.js';

interface ChargeExtendedInfoMenuProps {
  chargeId: string;
  chargeType: ChargesTableRowFieldsFragment['__typename'];
  setInsertDocument: () => void;
  setMatchDocuments: () => void;
  onChange?: () => void;
}

type ClickEvent = React.MouseEvent<HTMLAnchorElement, MouseEvent>;

export function ChargeExtendedInfoMenu({
  chargeId,
  chargeType,
  setInsertDocument,
  setMatchDocuments,
  onChange,
}: ChargeExtendedInfoMenuProps): ReactElement {
  const { deleteCharge } = useDeleteCharge();
  const [opened, setOpened] = useState(false);
  const [depreciationOpened, { open: openDepreciation, close: closeDepreciation }] =
    useDisclosure(false);
  const [miscExpensesOpened, setMiscExpensesOpened] = useState(false);
  const [uploadSalariesOpened, { open: openUploadSalaries, close: closeUploadSalaries }] =
    useDisclosure(false);

  const [uploadDocumentsOpen, setUploadDocumentsOpen] = useState(false);

  function onDelete(): void {
    deleteCharge({
      chargeId,
    });
    onChange?.();
  }

  function closeMenu(): void {
    setOpened(false);
  }

  return (
    <>
      <Menu shadow="md" width={200} opened={opened}>
        <Menu.Target>
          <Burger
            opened={opened}
            onClick={(event): void => {
              event.stopPropagation();
              setOpened(o => !o);
            }}
          />
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Charge</Menu.Label>
          <ConfirmationModal
            onConfirm={onDelete}
            title="Are you sure you want to delete this charge?"
          >
            <Menu.Item icon={<Trash size={14} />}>Delete Charge</Menu.Item>
          </ConfirmationModal>
          <Menu.Divider />
          <Menu.Label>Documents</Menu.Label>
          <Menu.Item
            icon={<ListPlus size={14} />}
            onClick={(event: ClickEvent): void => {
              event.stopPropagation();
              setInsertDocument();
              closeMenu();
            }}
          >
            Insert Document
          </Menu.Item>
          <Menu.Item
            icon={<FilePlus2 size={14} />}
            onClick={(event: ClickEvent): void => {
              event.stopPropagation();
              setUploadDocumentsOpen(true);
              closeMenu();
            }}
          >
            Upload Documents
          </Menu.Item>
          <Menu.Item
            icon={<Search size={14} />}
            onClick={(): void => {
              setMatchDocuments();
              closeMenu();
            }}
          >
            Match Document
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Misc Expenses</Menu.Label>
          <Menu.Item
            icon={<ListPlus size={14} />}
            onClick={(event: ClickEvent): void => {
              event.stopPropagation();
              closeMenu();
              setMiscExpensesOpened(true);
            }}
          >
            Add expense
          </Menu.Item>
          {chargeType === 'CommonCharge' && (
            <>
              <Menu.Divider />
              <Menu.Label>Depreciation</Menu.Label>
              <Menu.Item
                icon={<ArrowDownWideNarrow size={14} />}
                onClick={(event: ClickEvent): void => {
                  event.stopPropagation();
                  openDepreciation();
                  closeMenu();
                }}
              >
                Depreciation
              </Menu.Item>
            </>
          )}
          {chargeType === 'SalaryCharge' && (
            <>
              <Menu.Divider />
              <Menu.Label>Salaries</Menu.Label>
              <Menu.Item
                icon={<FilePlus2 size={14} />}
                onClick={(event: ClickEvent): void => {
                  event.stopPropagation();
                  closeMenu();
                  openUploadSalaries();
                }}
              >
                Payroll file upload
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
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
    </>
  );
}
