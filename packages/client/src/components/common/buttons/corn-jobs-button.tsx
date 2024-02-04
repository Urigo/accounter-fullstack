import { ReactElement, useCallback } from 'react';
import { ArrowBigRightLines } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useCornJobs } from '../../../hooks/use-corn-jobs.js';
import { ConfirmationModal } from '../modals/confirmation-modal.js';

export function CornJobsButton(): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);

  const { fetching, executeJobs } = useCornJobs();

  const onExecute = useCallback(() => {
    executeJobs().then(() => {
      close();
    });
  }, [executeJobs, close]);

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={close}
        onConfirm={onExecute}
        title="Are you sure you want to manually execute corn jobs?"
      />
      <Tooltip label="Execute corn jobs">
        <ActionIcon loading={fetching} size={30} onClick={open}>
          <ArrowBigRightLines size={20} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
