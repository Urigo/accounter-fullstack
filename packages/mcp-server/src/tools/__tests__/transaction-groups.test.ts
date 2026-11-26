import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GROUP_SAMPLE_SIZE,
  DEFAULT_GROUPS_LIMIT,
  MAX_GROUP_SAMPLE_SIZE,
  uncategorizedTransactionGroupsTool,
} from '../transaction-groups.js';
import { authContext, B1, B2, mutationClient, runTool } from './review-write-harness.js';

/**
 * `accounter_list_uncategorized_transaction_groups` is one upstream query. What matters is that
 * it is pinned to the one business asked for, forwards its filters and paging under the upstream
 * names, and reports paging over groups (not rows) correctly.
 */

const GROUP = {
  key: 'paypal *acme #',
  sampleDescription: 'PAYPAL *ACME 1234',
  transactionCount: 3,
  chargeCount: 3,
  totals: [
    { currency: 'USD', amount: -25, transactionCount: 2 },
    { currency: 'ILS', amount: -40, transactionCount: 1 },
  ],
  minEventDate: '2026-01-05',
  maxEventDate: '2026-03-01',
  transactionIds: ['t1', 't2'],
  chargeIds: ['c1', 'c2'],
};

const payload = (groups = [GROUP], totalGroups = groups.length, totalTransactions = 3) => ({
  totalGroups,
  totalTransactions,
  groups,
});

type Structured = {
  groups: Array<Record<string, unknown>>;
  returnedCount: number;
  totalCount: number;
  truncated: boolean;
  totalGroups: number;
  totalTransactions: number;
  offset: number;
  memberBusinessId: string;
};

describe('uncategorizedTransactionGroupsTool — request', () => {
  it('sends the business as the only owner, with the defaults', async () => {
    const { client, captured } = mutationClient('uncategorizedTransactionGroups', payload());
    await runTool(uncategorizedTransactionGroupsTool, { memberBusinessId: B1 }, client);

    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*query\b/);
    expect(captured[0].variables).toEqual({
      filters: { byOwners: [B1] },
      sampleSize: DEFAULT_GROUP_SAMPLE_SIZE,
      limit: DEFAULT_GROUPS_LIMIT,
      offset: 0,
    });
    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });

  it('forwards every filter under the upstream names', async () => {
    const { client, captured } = mutationClient('uncategorizedTransactionGroups', payload());
    await runTool(
      uncategorizedTransactionGroupsTool,
      {
        memberBusinessId: B1,
        fromDate: '2026-01-01',
        toDate: '2026-06-30',
        minCount: 2,
        keys: ['paypal *acme #'],
        sampleSize: 100,
        limit: 20,
        offset: 40,
      },
      client,
    );

    expect(captured[0].variables).toEqual({
      filters: {
        byOwners: [B1],
        fromEventDate: '2026-01-01',
        toEventDate: '2026-06-30',
        minCount: 2,
        keys: ['paypal *acme #'],
      },
      sampleSize: 100,
      limit: 20,
      offset: 40,
    });
  });

  it('picks the requested business when the caller has several', async () => {
    const { client, captured } = mutationClient('uncategorizedTransactionGroups', payload());
    await runTool(
      uncategorizedTransactionGroupsTool,
      { memberBusinessId: B2 },
      client,
      authContext([B1, B2]),
    );

    expect((captured[0].variables.filters as { byOwners: string[] }).byOwners).toEqual([B2]);
  });
});

describe('uncategorizedTransactionGroupsTool — guards', () => {
  const refused = async (args: Record<string, unknown>) => {
    const { client, captured } = mutationClient('uncategorizedTransactionGroups', null);
    const result = await runTool(uncategorizedTransactionGroupsTool, args, client);
    expect(result.isError).toBe(true);
    expect(captured).toHaveLength(0);
    return (result.structuredContent as { code: string }).code;
  };

  it('requires the business', async () => {
    expect(await refused({})).toBe('VALIDATION_ERROR');
  });

  it('refuses a business the caller is not a member of', async () => {
    expect(await refused({ memberBusinessId: B2 })).toBe('AUTHORIZATION_ERROR');
  });

  it.each([
    [{ fromDate: '2026-02-31' }],
    [{ fromDate: '2026-03-01', toDate: '2026-01-01' }],
    [{ sampleSize: MAX_GROUP_SAMPLE_SIZE + 1 }],
    [{ minCount: 0 }],
    [{ keys: [] }],
    [{ offset: -1 }],
  ])('refuses %o before any round trip', async args => {
    expect(await refused({ memberBusinessId: B1, ...args })).toBe('VALIDATION_ERROR');
  });
});

describe('uncategorizedTransactionGroupsTool — result', () => {
  it('shapes groups and carries the totals across pages', async () => {
    const { client } = mutationClient('uncategorizedTransactionGroups', payload());
    const result = await runTool(
      uncategorizedTransactionGroupsTool,
      { memberBusinessId: B1 },
      client,
    );

    const structured = result.structuredContent as Structured;
    expect(structured.groups).toEqual([
      {
        key: 'paypal *acme #',
        sampleDescription: 'PAYPAL *ACME 1234',
        transactionCount: 3,
        chargeCount: 3,
        totals: GROUP.totals,
        firstDate: '2026-01-05',
        lastDate: '2026-03-01',
        transactionIds: ['t1', 't2'],
        chargeIds: ['c1', 'c2'],
      },
    ]);
    expect(structured).toMatchObject({
      memberBusinessId: B1,
      totalGroups: 1,
      totalTransactions: 3,
      offset: 0,
      truncated: false,
    });
  });

  it('marks a page with more groups after it as truncated', async () => {
    const { client } = mutationClient('uncategorizedTransactionGroups', payload([GROUP], 10, 30));
    const result = await runTool(
      uncategorizedTransactionGroupsTool,
      { memberBusinessId: B1, limit: 1, offset: 4 },
      client,
    );

    const structured = result.structuredContent as Structured;
    expect(structured.returnedCount).toBe(1);
    expect(structured.totalCount).toBe(6);
    expect(structured.truncated).toBe(true);
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('says so when nothing is left to categorise', async () => {
    const { client } = mutationClient('uncategorizedTransactionGroups', payload([], 0, 0));
    const result = await runTool(
      uncategorizedTransactionGroupsTool,
      { memberBusinessId: B1 },
      client,
    );

    const structured = result.structuredContent as Structured;
    expect(structured.groups).toEqual([]);
    expect(structured.truncated).toBe(false);
  });
});
