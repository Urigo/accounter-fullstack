import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialBalanceRefreshContext } from '../trial-balance-refresh-context.js';
import {
  TrialBalanceReportBusiness,
  type ExtendedBusiness,
} from '../trial-balance-report-account.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let extendedInfoProps: { businessID: string; onInsertLedgerRecord?: () => void } | undefined;

vi.mock('../../../business-ledger/business-extended-info.js', () => ({
  BusinessExtendedInfo: (props: NonNullable<typeof extendedInfoProps>): ReactElement => {
    extendedInfoProps = props;
    return <div data-testid="extended-info" />;
  },
}));

const RECORD = {
  business: { id: 'entity-1', name: 'Entity' },
  debit: { raw: 0, formatted: '' },
  credit: { raw: 0, formatted: '' },
  total: { raw: 0, formatted: '' },
} as unknown as ExtendedBusiness;

describe('TrialBalanceReportBusiness', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    extendedInfoProps = undefined;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("passes the report's refresh to the expanded entity, opting it into inserting records", async () => {
    const refresh = vi.fn();
    await act(async () => {
      root.render(
        <TrialBalanceRefreshContext.Provider value={refresh}>
          <table>
            <tbody>
              <TrialBalanceReportBusiness record={RECORD} sortCodeKey={100} filter={{}} isAllOpened />
            </tbody>
          </table>
        </TrialBalanceRefreshContext.Provider>,
      );
    });

    expect(extendedInfoProps?.businessID).toBe('entity-1');
    expect(extendedInfoProps?.onInsertLedgerRecord).toBe(refresh);
  });
});
