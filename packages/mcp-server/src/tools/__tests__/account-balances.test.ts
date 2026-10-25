import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { ACCOUNT_BALANCES_CAVEATS, getAccountBalancesTool } from '../account-balances.js';
import { executeRegisteredTool } from '../execute.js';

function authContext(memberBusinessIds: string[], roleId = 'business_owner'): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: ['openid'],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId })),
  );
}

function clientReturning(rows: unknown[], capture?: (body: unknown) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(JSON.parse(init.body as string));
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { financialAccountBalances: rows } }),
    } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function balance(accountNumber: string, currency: string, raw: number, asOfDate: string) {
  return {
    account: {
      __typename: 'BankFinancialAccount',
      id: `acc-${accountNumber}`,
      name: `Account ${accountNumber}`,
      number: accountNumber,
      type: 'BANK_ACCOUNT',
      bankNumber: 12,
      branchNumber: 615,
    },
    currency,
    balance: { raw, currency },
    asOfDate,
    valueDate: asOfDate,
    transactionId: `tx-${accountNumber}-${currency}`,
    ownerId: 'b1',
  };
}

const run = (client: UpstreamGraphQLClient, rawArgs: unknown) =>
  executeRegisteredTool({
    tool: getAccountBalancesTool,
    rawArgs,
    auth: authContext(['b1']),
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });

describe('getAccountBalancesTool', () => {
  it('returns one row per account and currency, with per-currency totals and caveats', async () => {
    const client = clientReturning([
      balance('590830', 'USD', 173800.25, '2026-10-23'),
      balance('466803', 'ILS', 51234.5, '2026-10-23'),
      balance('466803', 'USD', 20000, '2026-10-21'),
    ]);
    const result = await run(client, { asOfDate: '2026-10-25' });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      balances: Array<Record<string, unknown>>;
      byCurrency: unknown[];
      caveats: readonly string[];
      totalCount: number;
    };
    expect(structured.totalCount).toBe(3);
    // Sorted by account number, then currency.
    expect(structured.balances.map(b => `${b.accountNumber}/${b.currency}`)).toEqual([
      '466803/ILS',
      '466803/USD',
      '590830/USD',
    ]);
    expect(structured.balances[1]).toMatchObject({
      accountId: 'acc-466803',
      bankNumber: 12,
      branchNumber: 615,
      balance: { value: 20000, currency: 'USD' },
      asOfDate: '2026-10-21',
      daysOld: 4,
      transactionId: 'tx-466803-USD',
    });
    expect(structured.byCurrency).toEqual([
      { currency: 'ILS', accountCount: 1, total: 51234.5, oldestAsOfDate: '2026-10-23' },
      { currency: 'USD', accountCount: 2, total: 193800.25, oldestAsOfDate: '2026-10-21' },
    ]);
    expect(structured.caveats).toEqual(ACCOUNT_BALANCES_CAVEATS);
  });

  it('forwards accountIds and asOfDate upstream', async () => {
    let sent: unknown;
    const client = clientReturning([], body => (sent = body));
    const accountId = '00000000-0000-0000-0000-0000000000aa';
    const result = await run(client, { accountIds: [accountId], asOfDate: '2026-09-30' });

    expect(result.isError).toBeUndefined();
    expect((sent as { variables: unknown }).variables).toEqual({
      accountIds: [accountId],
      asOfDate: '2026-09-30',
    });
  });

  it('rejects a malformed date', async () => {
    const result = await run(clientReturning([]), { asOfDate: '25/10/2026' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});
