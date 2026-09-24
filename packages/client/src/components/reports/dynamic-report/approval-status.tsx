import type { ReactElement, ReactNode } from 'react';
import type { AccountantStatus } from '../../../gql/graphql.js';
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
  | {
      kind: 'leaf';
      approval: EffectiveApproval;
      /** Stages a new status for this leaf. Without it the status is read-only. */
      onChange?: (status: AccountantStatus) => void;
      /** Why statuses can't be changed right now; the status is read-only while it is set. */
      disabledReason?: string | null;
    }
  | { kind: 'branch'; counts: ApprovalCounts };

// Branch statuses are read-only for now: bulk set from a branch is wired in a later step.
const noop = (): void => {};

export function LeafApprovalStatus({
  approval,
  onChange,
  disabledReason,
}: {
  approval: EffectiveApproval;
  onChange?: (status: AccountantStatus) => void;
  disabledReason?: string | null;
}): ReactElement {
  const attribution = leafApprovalTooltip(approval);
  let tooltip: ReactNode = attribution ?? undefined;
  if (disabledReason) {
    // A read-only status still says who set it — that is what an older baseline is pinned to see.
    tooltip = attribution ? (
      <>
        <div>{attribution}</div>
        <div className="opacity-80">{disabledReason}</div>
      </>
    ) : (
      disabledReason
    );
  }

  return (
    <AccountantStatusMenu
      value={approval.status}
      onChange={onChange ?? noop}
      disabled={!onChange || !!disabledReason}
      tooltip={tooltip}
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
    <LeafApprovalStatus
      approval={approval.approval}
      onChange={approval.onChange}
      disabledReason={approval.disabledReason}
    />
  ) : (
    <BranchApprovalStatus counts={approval.counts} />
  );
}
