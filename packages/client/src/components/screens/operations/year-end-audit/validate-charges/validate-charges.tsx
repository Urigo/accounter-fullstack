import { Eye } from 'lucide-react';
import type { AuditStepInfo } from '../audit-step.js';
import { ExpandedCharges } from './expanded-charges.js';

export interface ChargeValidationData {
  approvedPercentage: number;
  pendingPercentage: number;
  unapprovedPercentage: number;
  totalCharges: number;
  approvedCount: number;
  pendingCount: number;
  unapprovedCount: number;
}

export function ValidateChargesStep(): AuditStepInfo {
  const chargeValidationData: ChargeValidationData = {
    approvedPercentage: 65,
    pendingPercentage: 22,
    unapprovedPercentage: 13,
    totalCharges: 1247,
    approvedCount: 811,
    pendingCount: 275,
    unapprovedCount: 161,
  };

  return {
    id: '2',
    title: 'Validate All Charges',
    description: 'Ensure all charges of the year were reviewed, handle pending charges',
    status:
      chargeValidationData.pendingPercentage === 0
        ? 'completed'
        : chargeValidationData.pendingPercentage < 30
          ? 'in-progress'
          : 'pending',
    icon: <Eye className="h-4 w-4" />,
    actions: [
      { label: 'Review Charges', href: '/charges/review' },
      { label: 'Pending Charges', href: '/charges/pending' },
      { label: 'Setup Bi-weekly Followup', href: '/followup/setup' },
    ],
    expansion: <ExpandedCharges chargeData={chargeValidationData} />,
  };
}
