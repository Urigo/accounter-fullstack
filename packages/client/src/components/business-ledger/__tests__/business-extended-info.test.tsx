import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessExtendedInfo } from '../business-extended-info.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { reexecuteQuery, useQueryMock } = vi.hoisted(() => ({
  reexecuteQuery: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof import('urql')>()),
  useQuery: useQueryMock,
}));

let modalProps: { chargeId?: string; defaultEntityId?: string; onDone: () => void } | undefined;

// The modal has its own tests; this stub exposes the props the toolbar passes it
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

describe('BusinessExtendedInfo', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    modalProps = undefined;
    reexecuteQuery.mockReset();
    useQueryMock.mockReset().mockReturnValue([
      {
        data: {
          businessTransactionsFromLedgerRecords: {
            __typename: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult',
            businessTransactions: [],
          },
        },
        fetching: false,
      },
      reexecuteQuery,
    ]);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const insertButton = (): Element | null =>
    container.querySelector('[data-testid="insert-ledger-record"]');

  it('offers no "+" unless the host opts in', async () => {
    await act(async () => {
      root.render(<BusinessExtendedInfo businessID="entity-1" />);
    });

    expect(insertButton()).toBeNull();
    expect(modalProps).toBeUndefined();
  });

  it('offers a "+" on a new charge, prefilled with the entity, when the host opts in', async () => {
    await act(async () => {
      root.render(<BusinessExtendedInfo businessID="entity-1" onInsertLedgerRecord={vi.fn()} />);
    });

    expect(insertButton()).not.toBeNull();
    expect(modalProps).not.toHaveProperty('chargeId');
    expect(modalProps?.defaultEntityId).toBe('entity-1');
  });

  it('refetches its records from the network and notifies the host after an insert', async () => {
    const onInsertLedgerRecord = vi.fn();
    await act(async () => {
      root.render(
        <BusinessExtendedInfo businessID="entity-1" onInsertLedgerRecord={onInsertLedgerRecord} />,
      );
    });

    await act(async () => {
      (insertButton() as HTMLElement).click();
    });

    expect(reexecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
    expect(onInsertLedgerRecord).toHaveBeenCalledTimes(1);
  });
});
