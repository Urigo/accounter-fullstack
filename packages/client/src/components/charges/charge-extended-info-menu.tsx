import { ReactElement, useState } from 'react';
import 'tabler-icons-react';
import { ArrowDownWideNarrow, FilePlus2, ListPlus, Search, Trash } from 'lucide-react';
import { Burger, Menu, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ChargesTableRowFieldsFragment } from '../../gql/graphql.js';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import { Depreciation } from '../common/depreciation/index.js';
import { ConfirmationModal, InsertMiscExpense, UploadPayrollFile } from '../common/index.js';

interface ChargeExtendedInfoMenuProps {
  chargeId: string;
  chargeType: ChargesTableRowFieldsFragment['__typename'];
  setInsertDocument: () => void;
  setMatchDocuments: () => void;
  setUploadDocument: () => void;
  onChange?: () => void;
}

type ClickEvent = React.MouseEvent<HTMLAnchorElement, MouseEvent>;

export function ChargeExtendedInfoMenu({
  chargeId,
  chargeType,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
  onChange,
}: ChargeExtendedInfoMenuProps): ReactElement {
  const { deleteCharge } = useDeleteCharge();
  const [opened, setOpened] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [depreciationOpened, { open: openDepreciation, close: closeDepreciation }] =
    useDisclosure(false);
  const [miscExpensesOpened, { open: openMiscExpenses, close: closeMiscExpenses }] =
    useDisclosure(false);
  const [uploadSalariesOpened, { open: openUploadSalaries, close: closeUploadSalaries }] =
    useDisclosure(false);

  function onDelete(): void {
    deleteCharge({
      chargeId,
    });
    setModalOpened(false);
    onChange?.();
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
            onClick={(event: ClickEvent): void => {
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
            icon={<ListPlus size={14} />}
            onClick={(event: ClickEvent): void => {
              event.stopPropagation();
              closeMenu();
              openMiscExpenses();
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
      <Modal
        centered
        opened={miscExpensesOpened}
        onClose={closeMiscExpenses}
        title="Insert Misc Expense"
        onClick={event => event.stopPropagation()}
      >
        <InsertMiscExpense
          onDone={() => {
            closeMiscExpenses();
            onChange?.();
          }}
          chargeId={chargeId}
        />
      </Modal>
      <Modal
        centered
        opened={uploadSalariesOpened}
        onClose={closeUploadSalaries}
        title="Insert Misc Expense"
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
    </>
  );
}
