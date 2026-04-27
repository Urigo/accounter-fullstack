import { ComponentProps } from 'react';
import { Settings } from 'lucide-react';
import { AuditStep, AuditStepInfo } from '../audit-step.js';

type Props = Omit<ComponentProps<typeof AuditStep>, 'step'> & {
  id: string;
};

export function PendingLedgerChangesStep({ id, ...props }: Props) {
  const step: AuditStepInfo = {
    id,
    title: 'Check Pending Ledger Changes',
    description: 'Ensure no pending ledger changes exist',
    status: 'in-progress',
    icon: <Settings className="h-4 w-4" />,
    actions: [
      { label: 'View Ledger Status', href: '/ledger/status' },
      { label: 'Resolve Pending Changes', href: '/ledger/pending' },
    ],
  };
  return <AuditStep step={step} {...props} />;
}
