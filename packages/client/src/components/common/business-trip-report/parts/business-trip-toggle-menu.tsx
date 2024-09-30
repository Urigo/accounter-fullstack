import { ReactElement, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { Burger, Menu } from '@mantine/core';
import { useCreditShareholdersBusinessTripTnS } from '../../../../hooks/use-credit-shareholders-business-trip-tns.js';
import { ConfirmationModal } from '../../../common/index.js';

interface Props {
  businessTripId: string;
}

export function BusinessTripToggleMenu({ businessTripId }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);

  function closeMenu(): void {
    setOpened(false);
  }
  const { creditShareholders } = useCreditShareholdersBusinessTripTnS();

  return (
    <>
      <ConfirmationModal
        opened={modalOpened}
        onClose={(): void => setModalOpened(false)}
        onConfirm={() => {
          creditShareholders({ businessTripId });
          setModalOpened(false);
        }}
        title="Credit shareholders with travel and subsistence surplus?"
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
          <Menu.Label>Summarize Trip</Menu.Label>
          <Menu.Item
            icon={<HandCoins size={14} />}
            onClick={(): void => {
              setModalOpened(true);
              closeMenu();
            }}
          >
            Credit surplus T&S
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
