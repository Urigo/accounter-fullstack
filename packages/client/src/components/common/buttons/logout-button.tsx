import { ReactElement, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logout } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ConfirmationModal } from '../modals/confirmation-modal.jsx';

export function LogoutButton(): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);
  const navigate = useNavigate();

  const onLogout = useCallback(() => {
    navigate('/login');
    close();
  }, [navigate, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onLogout}
        title="Are you sure you want to logout?"
      />
      <Tooltip label="Logout">
        <ActionIcon size={30} onClick={open}>
          <Logout size={20} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
