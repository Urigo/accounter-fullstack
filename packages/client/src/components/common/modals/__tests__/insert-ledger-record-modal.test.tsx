import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../providers/user-provider.js';
import type { LedgerRecordFormValues } from '../../forms/ledger-record-form/schema.js';
import { InsertLedgerRecordModal } from '../insert-ledger-record-modal.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const insertLedgerRecord =
  vi.fn<(variables: Record<string, unknown>) => Promise<{ record: { id: string } } | void>>();

vi.mock('../../../../hooks/use-insert-ledger-record.js', () => ({
  useInsertLedgerRecord: () => ({ fetching: false, insertLedgerRecord }),
}));

const SUBMITTED_VALUES: LedgerRecordFormValues = {
  operation: LedgerRecordOperation.Document,
  invoiceDate: '2026-03-15',
  valueDate: '2026-03-16',
  description: 'Consulting',
  reference: '',
  debitEntity1: 'debit-entity',
  debitLocalAmount1: 117,
  creditEntity1: 'credit-entity',
  creditLocalAmount1: 117,
};

// The real form needs the entities query; it has its own render test, and the schema and mapper
// have theirs. This stub submits fixed values.
vi.mock('../../forms/ledger-record-form/index.js', () => ({
  LedgerRecordForm: ({
    onSubmit,
  }: {
    onSubmit: (values: LedgerRecordFormValues) => Promise<void>;
  }): ReactElement => (
    <div data-testid="ledger-record-form">
      <button
        type="button"
        data-testid="stub-submit"
        onClick={() => void onSubmit(SUBMITTED_VALUES)}
      >
        submit
      </button>
    </div>
  ),
}));

const userContext = {
  username: 'tester',
  context: { defaultLocalCurrency: Currency.Usd, ledgerLock: null },
} as unknown as UserInfo;

describe('InsertLedgerRecordModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onDone = vi.fn<() => void>();

  beforeEach(async () => {
    insertLedgerRecord.mockReset();
    onDone.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <UserContext.Provider value={{ userContext, setUserContext: () => void 0 }}>
          <InsertLedgerRecordModal chargeId="charge-1" onDone={onDone} />
        </UserContext.Provider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function click(element: Element | null): Promise<void> {
    expect(element).not.toBeNull();
    await act(async () => {
      (element as HTMLElement).click();
    });
  }

  const dialog = (): Element | null => document.querySelector('[role="dialog"]');

  async function openAndSubmit(): Promise<void> {
    await click(container.querySelector('button[aria-label="Add ledger record"]'));
    expect(dialog()).not.toBeNull();
    await click(document.querySelector('[data-testid="stub-submit"]'));
  }

  it('inserts the mapped record, closes the dialog and calls onDone on success', async () => {
    insertLedgerRecord.mockResolvedValue({ record: { id: 'record-1' } });
    await openAndSubmit();

    expect(insertLedgerRecord).toHaveBeenCalledTimes(1);
    expect(insertLedgerRecord.mock.calls[0][0]).toEqual({
      chargeId: 'charge-1',
      operation: LedgerRecordOperation.Document,
      input: expect.objectContaining({
        currency: Currency.Usd,
        debitEntity1: 'debit-entity',
        debitLocalAmount1: 117,
        creditEntity1: 'credit-entity',
        creditLocalAmount1: 117,
        debitForeignAmount1: null,
        debitEntity2: null,
        reference: null,
      }),
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('keeps the dialog open when the server rejects the record', async () => {
    insertLedgerRecord.mockResolvedValue(undefined);
    await openAndSubmit();

    expect(insertLedgerRecord).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });
});
