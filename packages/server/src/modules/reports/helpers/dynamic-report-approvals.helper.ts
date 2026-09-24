import { z } from 'zod';
import type { AccountantStatus } from '../../../__generated__/types.js';
import { UUID_REGEX } from '../../../shared/constants.js';
import type { LeafApprovals } from '../types.js';

/**
 * The GraphQL `AccountantStatus` values, for validating leaf statuses both as submitted and as
 * stored. Typed as an exhaustive map so adding or removing an enum value fails to compile here
 * instead of silently rejecting valid statuses at runtime.
 */
export const accountantStatusSchema = z.enum({
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  UNAPPROVED: 'UNAPPROVED',
} as const satisfies { [S in AccountantStatus]: S });

export type IncomingLeafApproval = {
  entityId: string;
  status: AccountantStatus;
};

export type StampApprovalsParams = {
  /** Effective status of every counted leaf, as submitted by the client. */
  incoming: IncomingLeafApproval[];
  /** Fingerprints submitted with the same save, keyed by entity id. */
  incomingFingerprints: Record<string, string>;
  /** Financial-entity leaf ids of the submitted tree. */
  leafIds: Set<string>;
  /** The previous comparable snapshot, or null when this is the first one. */
  previous: {
    approvals: LeafApprovals;
    fingerprints: Record<string, string>;
  } | null;
  userId: string | null;
  /** ISO timestamp from the server clock. */
  now: string;
};

/**
 * Builds the `leaf_approvals` payload of a new snapshot from the submitted statuses.
 *
 * - Entries whose entity is not a leaf of the submitted tree are dropped.
 * - An unchanged status carries the previous stamp forward.
 * - APPROVED -> PENDING with a changed fingerprint is a regression: system stamp.
 * - UNAPPROVED with no previous entry is omitted (absent means UNAPPROVED).
 * - Anything else gets a user stamp.
 */
export function stampApprovals({
  incoming,
  incomingFingerprints,
  leafIds,
  previous,
  userId,
  now,
}: StampApprovalsParams): LeafApprovals {
  const result: LeafApprovals = {};
  for (const { entityId, status } of incoming) {
    if (!leafIds.has(entityId)) {
      continue;
    }
    const prev = previous?.approvals[entityId];
    const fingerprintChanged = previous?.fingerprints[entityId] !== incomingFingerprints[entityId];

    // An APPROVED re-submitted over a changed ledger is a new sign-off of different records, so it
    // gets a fresh stamp rather than the one that approved the old content.
    if (prev?.status === status && !(status === 'APPROVED' && fingerprintChanged)) {
      result[entityId] = { ...prev };
      continue;
    }

    if (prev?.status === 'APPROVED' && status === 'PENDING' && fingerprintChanged) {
      result[entityId] = { status, setBy: null, setAt: now, system: true };
      continue;
    }

    if (status === 'UNAPPROVED' && !prev) {
      continue;
    }

    result[entityId] = { status, setBy: userId, setAt: now, system: false };
  }
  return result;
}

/**
 * The statuses to stamp for a save that submitted none, i.e. a client that predates approvals:
 * every previously stored status, with the regression rule a reading client applies — an APPROVED
 * leaf whose fingerprint changed since then comes back as PENDING.
 *
 * Passed to `stampApprovals` as `incoming`, unchanged stamps carry forward and regressions get a
 * system stamp, so such a save neither erases the review trail nor re-approves a changed ledger.
 */
export function carryForwardApprovals(
  previous: StampApprovalsParams['previous'],
  incomingFingerprints: Record<string, string>,
): IncomingLeafApproval[] {
  if (!previous) {
    return [];
  }
  return Object.entries(previous.approvals).map(([entityId, { status }]) => ({
    entityId,
    status:
      status === 'APPROVED' && previous.fingerprints[entityId] !== incomingFingerprints[entityId]
        ? 'PENDING'
        : status,
  }));
}

const leafApprovalSchema = z.object({
  status: accountantStatusSchema,
  setBy: z.string().nullable(),
  // Always written from the server clock; anything that is not a timestamp is a malformed row.
  setAt: z.iso.datetime({ offset: true }),
  system: z.boolean(),
});

const leafApprovalsSchema = z.record(
  z.string().regex(UUID_REGEX, 'Invalid UUID'),
  leafApprovalSchema,
);

/**
 * Parses a stored `leaf_approvals` value (jsonb object, or its JSON string form).
 * Returns {} for null, undefined or anything that does not match the expected shape.
 */
export function parseLeafApprovals(raw: unknown): LeafApprovals {
  if (raw == null) {
    return {};
  }
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  const parsed = leafApprovalsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
