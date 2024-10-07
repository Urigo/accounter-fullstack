import { ReactElement, useState } from 'react';
import { FileUpload, PlaylistAdd, Search, Trash } from 'tabler-icons-react';
import { Burger, Menu, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import { Depreciation } from '../common/depreciation/index.jsx';
import { ConfirmationModal, InsertMiscExpense } from '../common/index.js';

interface ChargeExtendedInfoMenuProps {
  chargeId: string;
  setInsertDocument: () => void;
  setMatchDocuments: () => void;
  setUploadDocument: () => void;
}

export function ChargeExtendedInfoMenu({
  chargeId,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
}: ChargeExtendedInfoMenuProps): ReactElement {
  const { deleteCharge } = useDeleteCharge();
  const [opened, setOpened] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [depreciationOpened, { open: openDepreciation, close: closeDepreciation }] =
    useDisclosure(false);
  const [miscExpensesOpened, { open: openMiscExpenses, close: closeMiscExpenses }] =
    useDisclosure(false);

  function onDelete(): void {
    deleteCharge({
      chargeId,
    });
    setModalOpened(false);
  }

  function closeMenu(): void {
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={modalOpened}
        onClose={(): void => setModalOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this charge?"
      />
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
          <Menu.Item
            icon={<Trash size={14} />}
            onClick={(event): void => {
              event.stopPropagation();
              setModalOpened(true);
              closeMenu();
            }}
          >
            Delete Charge
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Documents</Menu.Label>
          <Menu.Item
            icon={<PlaylistAdd size={14} />}
            onClick={(event): void => {
              event.stopPropagation();
              setInsertDocument();
              closeMenu();
            }}
          >
            Insert Document
          </Menu.Item>
          <Menu.Item
            icon={<FileUpload size={14} />}
            onClick={(event): void => {
              event.stopPropagation();
              setUploadDocument();
              closeMenu();
            }}
          >
            Upload Document
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
            icon={<Search size={14} />}
            onClick={(event): void => {
              event.stopPropagation();
              closeMenu();
              openMiscExpenses();
            }}
          >
            Add expense
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Depreciation</Menu.Label>
          <Menu.Item
            icon={<Trash size={14} />}
            onClick={(event): void => {
              event.stopPropagation();
              openDepreciation();
              closeMenu();
            }}
          >
            Depreciation
          </Menu.Item>
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
        <Depreciation chargeId={chargeId} onChange={closeDepreciation} />
      </Modal>
      <Modal
        centered
        opened={miscExpensesOpened}
        onClose={closeMiscExpenses}
        title="Insert Misc Expense"
        onClick={event => event.stopPropagation()}
      >
        <InsertMiscExpense onDone={closeMiscExpenses} chargeId={chargeId} />
      </Modal>
    </>
  );
}
