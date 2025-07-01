import { useEffect, useState } from 'react';
import { BaseStepCard, type BaseStepProps, type StepAction, type StepStatus } from './step-base.js';

interface SimpleStepProps extends BaseStepProps {
  defaultStatus?: StepStatus;
  actions?: StepAction[];
  fetchStatus?: () => Promise<StepStatus>;
  onStatusChange?: (id: string, status: StepStatus) => void;
}

export default function SimpleStep({
  defaultStatus = 'pending',
  actions = [],
  fetchStatus,
  onStatusChange,
  ...props
}: SimpleStepProps) {
  const [status, setStatus] = useState<StepStatus>(fetchStatus ? 'loading' : defaultStatus);

  // Report status changes to parent
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(props.id, status);
    }
  }, [status, onStatusChange, props.id]);

  useEffect(() => {
    if (fetchStatus) {
      fetchStatus()
        .then(setStatus)
        .catch(() => setStatus('blocked'));
    }
  }, [fetchStatus]);

  return (
    <BaseStepCard {...props} status={status} actions={actions} onStatusChange={onStatusChange} />
  );
}
