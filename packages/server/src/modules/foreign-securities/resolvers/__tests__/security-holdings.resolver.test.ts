import type { Injector } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { ForeignSecuritiesProvider } from '../../providers/foreign-securities.provider.js';
import { SecurityBusinessesProvider } from '../../providers/security-businesses.provider.js';
import type { SecurityExecutionRow, SecurityHoldingProto } from '../../types.js';
import { foreignSecuritiesResolvers } from '../foreign-securities.resolver.js';
import { securityBusinessesResolvers } from '../security-businesses.resolver.js';

// Synthetic values only — never lifted from a real bank capture.
const OWNER_ID = 'owner-business';
const FUND = 'business-fund';
const OLD_ACCOUNT = 111_111;
const NEW_ACCOUNT = 222_222;

function execution(
  id: string,
  accountNumber: number,
  overrides: Partial<SecurityExecutionRow> = {},
): SecurityExecutionRow {
  return {
    id,
    owner_id: OWNER_ID,
    bank_number: 12,
    branch_number: 600,
    account_number: accountNumber,
    trade_date: '2024-01-10',
    trade_type: 'קניה',
    nv: '10',
    net_value_trade_currency: '-1000.00',
    trade_currency: 'דולר ארה"ב',
    ...overrides,
  } as SecurityExecutionRow;
}

/** Bought in the old account and moved to the new one, where more was bought */
const executions = [
  execution('buy-old', OLD_ACCOUNT),
  execution('out', OLD_ACCOUNT, {
    trade_date: '2024-06-01',
    trade_type: 'העברה לחובת הפקדון',
    net_value_trade_currency: '0',
  }),
  execution('in', NEW_ACCOUNT, {
    trade_date: '2024-06-02',
    trade_type: 'העברה לזכות הפקדון',
    net_value_trade_currency: '0',
  }),
  execution('buy-new', NEW_ACCOUNT, { trade_date: '2024-07-01', nv: '5' }),
];

const injector = {
  get: (token: unknown) => {
    if (token === SecurityBusinessesProvider) {
      return {
        getAllSecurityBusinesses: async () => [{ id: FUND, isin: 'ZZ0000000001', eng_name: 'Fund' }],
      };
    }
    if (token === ForeignSecuritiesProvider) {
      return { getExecutionsBySecurityBusiness: async () => new Map([[FUND, executions]]) };
    }
    throw new Error(`Unexpected provider token: ${String(token)}`);
  },
} as unknown as Injector;

const securityHoldings = securityBusinessesResolvers.Query!.securityHoldings as unknown as (
  parent: object,
  args: { includeClosed: boolean },
  context: { injector: Injector },
) => Promise<SecurityHoldingProto[]>;

const accountSummary = (holding: SecurityHoldingProto) =>
  holding.accounts.map(({ account, position }) => [account.accountNumber, position.quantity]);

describe('securityHoldings accounts', () => {
  it('splits a holding by account, leaving out accounts that hold nothing', async () => {
    const [holding] = await securityHoldings({}, { includeClosed: false }, { injector });

    expect(holding.position.quantity).toBe(15);
    expect(accountSummary(holding)).toEqual([[NEW_ACCOUNT, 15]]);
  });

  it('lists the emptied account too when closed positions are asked for', async () => {
    const [holding] = await securityHoldings({}, { includeClosed: true }, { injector });

    expect(accountSummary(holding)).toEqual([
      [OLD_ACCOUNT, 0],
      [NEW_ACCOUNT, 15],
    ]);
  });

  it("gives each account's share an id of its own", async () => {
    const [holding] = await securityHoldings({}, { includeClosed: true }, { injector });
    const ids = holding.accounts.flatMap(account => [account.id, account.position.id]);

    expect(new Set([...ids, holding.position.id]).size).toBe(ids.length + 1);
    expect(holding.accounts[0].id).toBe(`${FUND}:12-600-${OLD_ACCOUNT}`);
  });
});

describe('SecurityExecution.account', () => {
  const resolveAccount = foreignSecuritiesResolvers.SecurityExecution!.account as unknown as (
    parent: SecurityExecutionRow,
  ) => unknown;
  const resolveId = foreignSecuritiesResolvers.SecurityAccount!.id as unknown as (
    parent: unknown,
  ) => string;

  it("is the execution's bank, branch and account", () => {
    const account = resolveAccount(executions[2]);

    expect(account).toEqual({
      ownerId: OWNER_ID,
      bankNumber: 12,
      branchNumber: 600,
      accountNumber: NEW_ACCOUNT,
    });
    expect(resolveId(account)).toBe(`12-600-${NEW_ACCOUNT}`);
  });
});
