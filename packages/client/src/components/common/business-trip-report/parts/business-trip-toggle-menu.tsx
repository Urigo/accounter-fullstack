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
  const { creditShareholders } = useCreditShareholdersBusinessTripTnS();

  return (
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

        <ConfirmationModal
          onConfirm={() => {
            creditShareholders({ businessTripId });
          }}
          title="Credit shareholders with travel and subsistence surplus?"
        >
          <Menu.Item icon={<HandCoins size={14} />}>Credit surplus T&S</Menu.Item>
        </ConfirmationModal>
      </Menu.Dropdown>
    </Menu>
  );
}
