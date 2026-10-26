import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SecurityExecutionsTable, type SecurityExecutionRow } from '../security-executions-table.js';
import { securityAccount, securityExecution } from './security-execution-fixtures.js';

const OLD_ACCOUNT = securityAccount(111_111, 'Old portfolio');
const NEW_ACCOUNT = securityAccount(222_222);

const transfer = (
  id: string,
  direction: 'in' | 'out',
  counterpart: { tradeDate: string; account: typeof OLD_ACCOUNT } | null,
) =>
  securityExecution(id, direction === 'in' ? NEW_ACCOUNT : OLD_ACCOUNT, {
    tradeType: direction === 'in' ? 'TRANSFER_IN' : 'TRANSFER_OUT',
    transactionType: 'TRANSFERS',
    netValue: { formatted: '$0.00' },
    transferCounterpart: counterpart && { id: `${id}-counterpart`, ...counterpart },
  });

describe('SecurityExecutionsTable', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (rows: unknown[], withAccount = false) =>
    act(() =>
      root.render(
        <SecurityExecutionsTable
          rows={rows.map(execution => ({ execution }) as SecurityExecutionRow)}
          withAccount={withAccount}
        />,
      ),
    );

  const typeCell = (row: number) =>
    container.querySelectorAll('tbody tr')[row]?.querySelectorAll('td')[2]?.textContent;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("names the other account of a transfer between the owner's accounts", () => {
    render([
      transfer('out', 'out', { tradeDate: '2024-06-02', account: NEW_ACCOUNT }),
      transfer('in', 'in', { tradeDate: '2024-06-01', account: OLD_ACCOUNT }),
    ]);

    expect(typeCell(0)).toContain('→ to 12-600-222222');
    expect(typeCell(1)).toContain('← from Old portfolio');
    expect(container.textContent).not.toContain('Unknown cost');
  });

  it('flags a transfer in with no transfer out behind it as of unknown cost', () => {
    render([transfer('in', 'in', null)]);

    expect(typeCell(0)).toContain('Unknown cost');
  });

  it('says a transfer out that arrived nowhere left the accounts', () => {
    render([transfer('out', 'out', null)]);

    expect(typeCell(0)).toContain('Left your accounts');
  });

  it('notes nothing on executions that are not transfers', () => {
    render([securityExecution('buy', OLD_ACCOUNT)]);

    expect(typeCell(0)).toBe('Buy');
  });

  it('shows the account column only when asked', () => {
    render([securityExecution('buy', OLD_ACCOUNT)]);
    expect(container.querySelector('thead')?.textContent).not.toContain('Account');

    render([securityExecution('buy', OLD_ACCOUNT)], true);
    expect(container.querySelector('thead')?.textContent).toContain('Account');
    expect(container.querySelector('tbody')?.textContent).toContain('Old portfolio');
  });
});
