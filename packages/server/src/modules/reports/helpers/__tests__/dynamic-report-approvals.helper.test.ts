import { describe, expect, it } from 'vitest';
import type { LeafApprovals } from '../../types.js';
import {
  carryForwardApprovals,
  parseLeafApprovals,
  stampApprovals,
} from '../dynamic-report-approvals.helper.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const USER = 'user-new';
const NOW = '2026-09-23T10:00:00.000Z';
const OLD = '2026-01-01T00:00:00.000Z';

const userStamp = (status: 'APPROVED' | 'PENDING' | 'UNAPPROVED') => ({
  status,
  setBy: USER,
  setAt: NOW,
  system: false,
});

describe('stampApprovals', () => {
  it('carries the previous stamp forward when the status is unchanged', () => {
    const previousApprovals: LeafApprovals = {
      [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false },
      [B]: { status: 'PENDING', setBy: null, setAt: OLD, system: true },
    };
    const result = stampApprovals({
      incoming: [
        { entityId: A, status: 'APPROVED' },
        { entityId: B, status: 'PENDING' },
      ],
      incomingFingerprints: { [A]: 'fp-a', [B]: 'fp-b2' },
      leafIds: new Set([A, B]),
      previous: { approvals: previousApprovals, fingerprints: { [A]: 'fp-a', [B]: 'fp-b1' } },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual(previousApprovals);
    expect(result[A]).not.toBe(previousApprovals[A]);
  });

  it('user-stamps APPROVED -> APPROVED when the fingerprint changed (re-approval of new records)', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'APPROVED' }],
      incomingFingerprints: { [A]: 'fp-a2' },
      leafIds: new Set([A]),
      previous: {
        approvals: { [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false } },
        fingerprints: { [A]: 'fp-a1' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('APPROVED') });
  });

  it('gives a new status a user stamp', () => {
    const result = stampApprovals({
      incoming: [
        { entityId: A, status: 'APPROVED' },
        { entityId: B, status: 'PENDING' },
      ],
      incomingFingerprints: { [A]: 'fp-a', [B]: 'fp-b' },
      leafIds: new Set([A, B]),
      previous: {
        approvals: {
          [A]: { status: 'PENDING', setBy: 'user-old', setAt: OLD, system: false },
        },
        fingerprints: { [A]: 'fp-a', [B]: 'fp-b' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('APPROVED'), [B]: userStamp('PENDING') });
  });

  it('system-stamps APPROVED -> PENDING when the fingerprint changed', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'PENDING' }],
      incomingFingerprints: { [A]: 'fp-a-new' },
      leafIds: new Set([A]),
      previous: {
        approvals: { [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false } },
        fingerprints: { [A]: 'fp-a-old' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: { status: 'PENDING', setBy: null, setAt: NOW, system: true } });
  });

  it('system-stamps APPROVED -> PENDING when the entity had no previous fingerprint', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'PENDING' }],
      incomingFingerprints: { [A]: 'fp-a' },
      leafIds: new Set([A]),
      previous: {
        approvals: { [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false } },
        fingerprints: {},
      },
      userId: USER,
      now: NOW,
    });
    expect(result[A]).toEqual({ status: 'PENDING', setBy: null, setAt: NOW, system: true });
  });

  it('user-stamps APPROVED -> PENDING when the fingerprint is unchanged (manual change)', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'PENDING' }],
      incomingFingerprints: { [A]: 'fp-a' },
      leafIds: new Set([A]),
      previous: {
        approvals: { [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false } },
        fingerprints: { [A]: 'fp-a' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('PENDING') });
  });

  it('user-stamps a non-APPROVED -> PENDING change even when the fingerprint changed', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'PENDING' }],
      incomingFingerprints: { [A]: 'fp-a-new' },
      leafIds: new Set([A]),
      previous: {
        approvals: {
          [A]: { status: 'UNAPPROVED', setBy: 'user-old', setAt: OLD, system: false },
        },
        fingerprints: { [A]: 'fp-a-old' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('PENDING') });
  });

  it('omits UNAPPROVED entries with no previous entry', () => {
    const result = stampApprovals({
      incoming: [
        { entityId: A, status: 'UNAPPROVED' },
        { entityId: B, status: 'APPROVED' },
      ],
      incomingFingerprints: { [A]: 'fp-a', [B]: 'fp-b' },
      leafIds: new Set([A, B]),
      previous: { approvals: {}, fingerprints: {} },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [B]: userStamp('APPROVED') });
    expect(A in result).toBe(false);
  });

  it('keeps APPROVED -> UNAPPROVED with a user stamp', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'UNAPPROVED' }],
      incomingFingerprints: { [A]: 'fp-a-new' },
      leafIds: new Set([A]),
      previous: {
        approvals: { [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false } },
        fingerprints: { [A]: 'fp-a-old' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('UNAPPROVED') });
  });

  it('carries an existing UNAPPROVED stamp forward', () => {
    const prev = { status: 'UNAPPROVED' as const, setBy: 'user-old', setAt: OLD, system: false };
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'UNAPPROVED' }],
      incomingFingerprints: { [A]: 'fp-a' },
      leafIds: new Set([A]),
      previous: { approvals: { [A]: prev }, fingerprints: { [A]: 'fp-a' } },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: prev });
  });

  it('drops entries for entities that are not leaves of the submitted tree', () => {
    const result = stampApprovals({
      incoming: [
        { entityId: A, status: 'APPROVED' },
        { entityId: C, status: 'APPROVED' },
      ],
      incomingFingerprints: { [A]: 'fp-a', [C]: 'fp-c' },
      leafIds: new Set([A]),
      previous: {
        approvals: { [C]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false } },
        fingerprints: { [C]: 'fp-c' },
      },
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('APPROVED') });
  });

  it('drops previous entries that are not re-submitted', () => {
    const result = stampApprovals({
      incoming: [{ entityId: A, status: 'APPROVED' }],
      incomingFingerprints: { [A]: 'fp-a' },
      leafIds: new Set([A, B]),
      previous: {
        approvals: {
          [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false },
          [B]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false },
        },
        fingerprints: { [A]: 'fp-a', [B]: 'fp-b' },
      },
      userId: USER,
      now: NOW,
    });
    expect(Object.keys(result)).toEqual([A]);
  });

  it('user-stamps every non-UNAPPROVED entry when there is no previous snapshot', () => {
    const result = stampApprovals({
      incoming: [
        { entityId: A, status: 'APPROVED' },
        { entityId: B, status: 'PENDING' },
        { entityId: C, status: 'UNAPPROVED' },
      ],
      incomingFingerprints: { [A]: 'fp-a', [B]: 'fp-b', [C]: 'fp-c' },
      leafIds: new Set([A, B, C]),
      previous: null,
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({ [A]: userStamp('APPROVED'), [B]: userStamp('PENDING') });
  });

  it('returns an empty object for no incoming entries', () => {
    expect(
      stampApprovals({
        incoming: [],
        incomingFingerprints: {},
        leafIds: new Set([A]),
        previous: null,
        userId: USER,
        now: NOW,
      }),
    ).toEqual({});
  });
});

describe('carryForwardApprovals', () => {
  const previous = {
    approvals: {
      [A]: { status: 'APPROVED', setBy: 'user-old', setAt: OLD, system: false },
      [B]: { status: 'PENDING', setBy: 'user-old', setAt: OLD, system: false },
      [C]: { status: 'UNAPPROVED', setBy: 'user-old', setAt: OLD, system: false },
    } satisfies LeafApprovals,
    fingerprints: { [A]: 'fp-a', [B]: 'fp-b', [C]: 'fp-c' },
  };

  it('returns nothing when there is no previous snapshot', () => {
    expect(carryForwardApprovals(null, { [A]: 'fp-a' })).toEqual([]);
  });

  it('re-submits every stored status when no fingerprint changed', () => {
    expect(carryForwardApprovals(previous, previous.fingerprints)).toEqual([
      { entityId: A, status: 'APPROVED' },
      { entityId: B, status: 'PENDING' },
      { entityId: C, status: 'UNAPPROVED' },
    ]);
  });

  it('returns an APPROVED leaf as PENDING once its fingerprint changed, and only that one', () => {
    const changed = { [A]: 'fp-a2', [B]: 'fp-b2', [C]: 'fp-c2' };
    expect(carryForwardApprovals(previous, changed)).toEqual([
      { entityId: A, status: 'PENDING' },
      { entityId: B, status: 'PENDING' },
      { entityId: C, status: 'UNAPPROVED' },
    ]);
  });

  it('treats an APPROVED leaf with no fingerprint now as changed', () => {
    expect(carryForwardApprovals(previous, {})).toContainEqual({ entityId: A, status: 'PENDING' });
  });

  it('stamped, carries unchanged stamps verbatim and system-stamps the regression', () => {
    const incomingFingerprints = { [A]: 'fp-a2', [B]: 'fp-b', [C]: 'fp-c' };
    const result = stampApprovals({
      incoming: carryForwardApprovals(previous, incomingFingerprints),
      incomingFingerprints,
      leafIds: new Set([A, B]),
      previous,
      userId: USER,
      now: NOW,
    });
    expect(result).toEqual({
      [A]: { status: 'PENDING', setBy: null, setAt: NOW, system: true },
      [B]: previous.approvals[B],
      // C is no longer a leaf of the submitted tree, so it is dropped.
    });
  });
});

describe('parseLeafApprovals', () => {
  const valid: LeafApprovals = {
    [A]: { status: 'APPROVED', setBy: 'user-1', setAt: OLD, system: false },
    [B]: { status: 'PENDING', setBy: null, setAt: NOW, system: true },
  };

  it('returns a valid approvals object as-is', () => {
    expect(parseLeafApprovals(valid)).toEqual(valid);
  });

  it('parses a JSON string', () => {
    expect(parseLeafApprovals(JSON.stringify(valid))).toEqual(valid);
  });

  it('returns {} for null or undefined', () => {
    expect(parseLeafApprovals(null)).toEqual({});
    expect(parseLeafApprovals(undefined)).toEqual({});
  });

  it('returns {} for invalid input', () => {
    expect(parseLeafApprovals('not json')).toEqual({});
    expect(parseLeafApprovals(42)).toEqual({});
    expect(parseLeafApprovals([valid[A]])).toEqual({});
    expect(parseLeafApprovals({ [A]: { ...valid[A], status: 'MAYBE' } })).toEqual({});
    expect(parseLeafApprovals({ [A]: { ...valid[A], system: 'no' } })).toEqual({});
    expect(parseLeafApprovals({ [A]: { status: 'APPROVED' } })).toEqual({});
    expect(parseLeafApprovals({ 'not-a-uuid': valid[A] })).toEqual({});
  });

  it('returns {} when a setAt is not an ISO timestamp', () => {
    expect(parseLeafApprovals({ [A]: { ...valid[A], setAt: '' } })).toEqual({});
    expect(parseLeafApprovals({ [A]: { ...valid[A], setAt: 'yesterday' } })).toEqual({});
    expect(parseLeafApprovals({ [A]: { ...valid[A], setAt: '2026-09-23' } })).toEqual({});
  });

  it('accepts a setAt with an explicit UTC offset', () => {
    const withOffset = { [A]: { ...valid[A], setAt: '2026-09-23T13:00:00+03:00' } };
    expect(parseLeafApprovals(withOffset)).toEqual(withOffset);
  });
});
