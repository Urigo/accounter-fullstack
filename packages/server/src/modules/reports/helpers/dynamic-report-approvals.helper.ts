import { z } from 'zod';
import { UUID_REGEX } from '../../../shared/constants.js';
import type { LeafApprovals, LeafApprovalStatus } from '../types.js';

export type IncomingLeafApproval = {
  entityId: string;
  status: LeafApprovalStatus;
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

    if (prev?.status === status) {
      result[entityId] = { ...prev };
      continue;
    }

    if (
      prev?.status === 'APPROVED' &&
      status === 'PENDING' &&
      previous?.fingerprints[entityId] !== incomingFingerprints[entityId]
    ) {
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

const leafApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'PENDING', 'UNAPPROVED']),
  setBy: z.string().nullable(),
  setAt: z.string(),
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
