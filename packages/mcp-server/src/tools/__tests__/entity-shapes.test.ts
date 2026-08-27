import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { searchChargesTool } from '../charges.js';
import { chargeTypeFromTypename, normalizeAmount } from '../entity-shapes.js';
import { executeRegisteredTool } from '../execute.js';
import { balanceReportTool } from '../reports.js';

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(): McpAuthContext {
  return buildAuthContext(PRINCIPAL, [{ memberBusinessId: 'b1', roleId: 'accountant' }]);
}

function clientReturning(data: unknown) {
  const fetchImpl = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response,
  );
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

/**
 * Unit coverage for the derived fields the detail tools expose: local-currency
 * conversion, charge classification, and document direction. These are pure
 * functions, so they are exercised directly rather than through the executor —
 * the tool-level wiring is covered in `detail-tools.test.ts`.
 */

// ---------------------------------------------------------------------------
// Charge classification
// ---------------------------------------------------------------------------

describe('chargeTypeFromTypename', () => {
  it('maps typenames onto the byChargeTypes filter vocabulary', () => {
    expect(chargeTypeFromTypename('CommonCharge')).toBe('COMMON');
    expect(chargeTypeFromTypename('SalaryCharge')).toBe('PAYROLL');
    expect(chargeTypeFromTypename('MonthlyVatCharge')).toBe('VAT');
    expect(chargeTypeFromTypename('CreditcardBankCharge')).toBe('CREDITCARD_BANK');
  });

  it('returns null for an absent or unrecognized typename', () => {
    expect(chargeTypeFromTypename(undefined)).toBeNull();
    expect(chargeTypeFromTypename('SomeFutureCharge')).toBeNull();
  });
});

describe('one money shape, across every tool that emits money', () => {
  /**
   * `normalizeAmount` is the single definition of the money shape, but it had
   * been hand-rewritten in `search_charges` and `balance_report` — three copies
   * of the same `raw -> value` mapping with nothing keeping them in step. That
   * is drift that had already started, not a hypothetical.
   *
   * Asserted against the tools' real output rather than by grepping the source,
   * so a fourth copy that happens to be correct today still has to stay correct.
   */
  const MONEY_KEYS = ['value', 'formatted', 'currency'];

  it('normalizeAmount defines exactly the expected keys', () => {
    const amount = normalizeAmount({ raw: -180, formatted: '-180.00', currency: 'ILS' });

    expect(Object.keys(amount!).sort()).toEqual([...MONEY_KEYS].sort());
    expect(amount).toEqual({ value: -180, formatted: '-180.00', currency: 'ILS' });
  });

  it('maps a missing amount to null rather than an empty object', () => {
    expect(normalizeAmount(null)).toBeNull();
    expect(normalizeAmount(undefined)).toBeNull();
  });

  it('search_charges emits the shared shape', async () => {
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'c',
      authorization: 'Bearer t',
      client: clientReturning({
        allCharges: {
          nodes: [
            {
              id: 'c1',
              ownerId: 'b1',
              userDescription: 'x',
              owner: { id: 'b1', name: 'Acme' },
              totalAmount: { raw: -180, formatted: '-180.00', currency: 'ILS' },
              minEventDate: '2026-03-11',
            },
          ],
          pageInfo: { totalPages: 1, totalRecords: 1, currentPage: 1, pageSize: 10 },
        },
      }),
    });

    const [charge] = (result.structuredContent as { charges: Array<{ amount: object }> }).charges;
    expect(Object.keys(charge!.amount).sort()).toEqual([...MONEY_KEYS].sort());
    expect(charge!.amount).toEqual({ value: -180, formatted: '-180.00', currency: 'ILS' });
  });

  it('balance_report emits the shared shape', async () => {
    const result = await executeRegisteredTool({
      tool: balanceReportTool,
      rawArgs: { memberBusinessId: 'b1', fromDate: '2026-01-01', toDate: '2026-03-01' },
      auth: authContext(),
      correlationId: 'c',
      authorization: 'Bearer t',
      client: clientReturning({
        transactionsForBalanceReport: [
          {
            id: 't1',
            chargeId: 'c1',
            date: '2026-01-05',
            isFee: false,
            description: 'x',
            amount: { raw: 10, formatted: '10.00', currency: 'ILS' },
          },
        ],
      }),
    });

    const [row] = (result.structuredContent as { rows: Array<{ amount: object }> }).rows;
    expect(Object.keys(row!.amount).sort()).toEqual([...MONEY_KEYS].sort());
    expect(row!.amount).toEqual({ value: 10, formatted: '10.00', currency: 'ILS' });
  });
});
