import type { ReactElement } from 'react';
import { AccountantStatusMenu } from '../../common/inputs/accountant-status-menu.js';
import {
  branchApprovalTooltip,
  branchStatus,
  leafApprovalTooltip,
  type ApprovalCounts,
  type EffectiveApproval,
} from './utils/approvals.js';

/** What a report row shows in its status slot. */
export type RowApproval =
  { kind: 'leaf'; approval: EffectiveApproval } | { kind: 'branch'; counts: ApprovalCounts };

// Statuses are read-only for now: selecting one is wired in when staging lands.
const noop = (): void => {};

export function LeafApprovalStatus({ approval }: { approval: EffectiveApproval }): ReactElement {
  return (
    <AccountantStatusMenu
      value={approval.status}
      onChange={noop}
      disabled
      tooltip={leafApprovalTooltip(approval) ?? undefined}
    />
  );
}

export function BranchApprovalStatus({ counts }: { counts: ApprovalCounts }): ReactElement | null {
  const status = branchStatus(counts);
  if (!status) return null;
  return (
    <AccountantStatusMenu
      value={status}
      onChange={noop}
      disabled
      tooltip={branchApprovalTooltip(counts)}
    />
  );
}

export function RowApprovalStatus({ approval }: { approval: RowApproval }): ReactElement | null {
  return approval.kind === 'leaf' ? (
    <LeafApprovalStatus approval={approval.approval} />
  ) : (
    <BranchApprovalStatus counts={approval.counts} />
  );
}
