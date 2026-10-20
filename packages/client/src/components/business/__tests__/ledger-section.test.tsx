import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerSection } from '../ledger-section.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { reexecuteQuery, useQueryMock } = vi.hoisted(() => ({
  reexecuteQuery: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof import('urql')>()),
  useQuery: useQueryMock,
}));

vi.mock('../../ledger-table', () => ({
  LedgerTable: (): ReactElement => <div data-testid="ledger-table" />,
}));

let modalProps: { chargeId?: string; defaultEntityId?: string; onDone: () => void } | undefined;

// The modal has its own tests; this stub exposes the props the section passes it
vi.mock('../../common/modals/insert-ledger-record-modal.js', () => ({
  InsertLedgerRecordModal: (props: NonNullable<typeof modalProps>): ReactElement => {
    modalProps = props;
    return (
      <button type="button" data-testid="insert-ledger-record" onClick={props.onDone}>
        +
      </button>
    );
  },
}));

describe('LedgerSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    modalProps = undefined;
    reexecuteQuery.mockReset();
    useQueryMock
      .mockReset()
      .mockReturnValue([
        { data: { ledgerRecordsByFinancialEntity: [] }, fetching: false },
        reexecuteQuery,
      ]);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<LedgerSection businessId="business-1" />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('offers a "+" that creates a record on a new charge, prefilled with the business', () => {
    expect(container.querySelector('[data-testid="insert-ledger-record"]')).not.toBeNull();
    expect(modalProps).toBeDefined();
    expect(modalProps).not.toHaveProperty('chargeId');
    expect(modalProps?.defaultEntityId).toBe('business-1');
  });

  it('refetches the ledger from the network after a successful insert', async () => {
    await act(async () => {
      (container.querySelector('[data-testid="insert-ledger-record"]') as HTMLElement).click();
    });

    expect(reexecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });
});
