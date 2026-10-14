import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../gql/graphql.js';
import { useInsertLedgerRecord } from '../use-insert-ledger-record.js';

const { toastMock, mutateMock } = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toastMock: toast, mutateMock: vi.fn() };
});

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof import('urql')>()),
  useMutation: () => [{ fetching: false, error: undefined }, mutateMock],
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const VARIABLES = {
  chargeId: 'charge-1',
  operation: LedgerRecordOperation.MiscExpense,
  input: {
    debitEntity1: 'debit-entity',
    debitLocalAmount1: 100,
    creditEntity1: 'credit-entity',
    creditLocalAmount1: 100,
    currency: Currency.Ils,
    invoiceDate: '2026-03-15',
    valueDate: '2026-03-15',
  },
} as const;

async function renderHook(): Promise<() => ReturnType<typeof useInsertLedgerRecord>> {
  let current: ReturnType<typeof useInsertLedgerRecord> | undefined;
  function Harness(): null {
    current = useInsertLedgerRecord();
    return null;
  }
  await act(async () => {
    createRoot(document.createElement('div')).render(React.createElement(Harness));
  });
  return () => current!;
}

describe('useInsertLedgerRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves to the inserted record on success', async () => {
    const success = { __typename: 'InsertLedgerRecordSuccessfulResult', record: { id: 'r-1' } };
    mutateMock.mockResolvedValue({ data: { insertLedgerRecord: success } });
    const hook = await renderHook();

    await expect(hook().insertLedgerRecord(VARIABLES)).resolves.toEqual(success);
    expect(mutateMock).toHaveBeenCalledWith(VARIABLES);
    expect(toastMock.success).toHaveBeenCalledWith(
      'Success',
      expect.objectContaining({ description: 'Ledger record added' }),
    );
  });

  it('shows a CommonError message verbatim and resolves to nothing', async () => {
    const message =
      'This charge belongs to a different business. Narrow the business scope and try again.';
    mutateMock.mockResolvedValue({
      data: { insertLedgerRecord: { __typename: 'CommonError', message } },
    });
    const hook = await renderHook();

    await expect(hook().insertLedgerRecord(VARIABLES)).resolves.toBeUndefined();
    expect(toastMock.error).toHaveBeenCalledWith(
      'Error',
      expect.objectContaining({ description: message }),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
