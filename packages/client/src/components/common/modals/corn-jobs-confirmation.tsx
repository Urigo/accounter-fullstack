import { ReactElement, useCallback } from 'react';
import { useCornJobs } from '../../../hooks/use-corn-jobs.js';
import { ConfirmationModal } from '../modals/confirmation-modal.js';

interface Props {
  close: () => void;
  opened: boolean;
}

export function CornJobsConfirmation({ close, opened }: Props): ReactElement {
  const { executeJobs } = useCornJobs();

  const onExecute = useCallback(() => {
    executeJobs().then(() => {
      close();
    });
  }, [executeJobs, close]);

  return (
    <ConfirmationModal
      opened={opened}
      onClose={close}
      onConfirm={onExecute}
      title="Are you sure you want to manually execute corn jobs?"
    />
  );
}
