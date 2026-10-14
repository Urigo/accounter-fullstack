import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Currency,
  LedgerRecordsTableFieldsFragmentDoc,
  type LedgerRecordsTableFieldsFragment,
} from '../../../gql/graphql.js';
import { makeFragmentData } from '../../../gql/index.js';
import { EMPTY_UUID } from '../../../helpers/consts.js';
import { LedgerTable, type LedgerRecordRow } from '../index.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const account = (id: string, name: string) =>
  ({ __typename: 'LtdFinancialEntity', id, name }) as const;

function ledgerRecord(
  id: string,
  description: string,
  overrides: Partial<LedgerRecordsTableFieldsFragment> = {},
) {
  return makeFragmentData(
    {
      id,
      locked: false,
      currency: Currency.Ils,
      invoiceDate: '2026-03-15',
      valueDate: '2026-03-16',
      description,
      reference: null,
      debitAccount1: account('debit-entity', 'Debit Co'),
      creditAccount1: account('credit-entity', 'Credit Co'),
      debitAccount2: null,
      creditAccount2: null,
      localCurrencyDebitAmount1: { raw: 100, formatted: '₪100' },
      localCurrencyCreditAmount1: { raw: 100, formatted: '₪100' },
      localCurrencyDebitAmount2: null,
      localCurrencyCreditAmount2: null,
      debitAmount1: null,
      creditAmount1: null,
      debitAmount2: null,
      creditAmount2: null,
      ...overrides,
    },
    LedgerRecordsTableFieldsFragmentDoc,
  );
}

const UNLOCKED_ID = '11111111-1111-4111-8111-111111111111';
const LOCKED_ID = '22222222-2222-4222-8222-222222222222';
const DIFF_ID = '33333333-3333-4333-8333-333333333333';
const DELETED_ID = '44444444-4444-4444-8444-444444444444';

const STORED = [
  ledgerRecord(UNLOCKED_ID, 'Unlocked record'),
  ledgerRecord(LOCKED_ID, 'Locked record', { locked: true }),
  ledgerRecord(DIFF_ID, 'Diff record'),
  ledgerRecord(DELETED_ID, 'Deleted record'),
];
const DIFFERENCES = [
  ledgerRecord(DIFF_ID, 'Diff record (generated)'),
  ledgerRecord(EMPTY_UUID, 'New record'),
];
const MATCHES = [UNLOCKED_ID, LOCKED_ID];

describe('LedgerTable edit action', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onEditRecord = vi.fn<(record: LedgerRecordRow) => void>();
  const onAncestorClick = vi.fn<() => void>();

  beforeEach(() => {
    onEditRecord.mockReset();
    onAncestorClick.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(withEdit: boolean): Promise<void> {
    await act(async () => {
      root.render(
        // A row-level click handler above the table must not see the pencil's clicks
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={onAncestorClick}>
          {/* The account cells link to the entities' pages */}
          <MemoryRouter>
            <LedgerTable
              ledgerRecordsData={STORED}
              ledgerDiffData={DIFFERENCES}
              matches={MATCHES}
              onEditRecord={withEdit ? onEditRecord : undefined}
            />
          </MemoryRouter>
        </div>,
      );
    });
  }

  function row(description: string): HTMLTableRowElement {
    const match = Array.from(container.querySelectorAll('tbody tr')).find(element =>
      element.textContent?.includes(description),
    );
    expect(match).toBeDefined();
    return match as HTMLTableRowElement;
  }

  const editButton = (description: string): HTMLButtonElement | null =>
    row(description).querySelector('button[aria-label="Edit ledger record"]');

  it('shows a pencil on an unlocked stored row, which opens it for editing', async () => {
    await render(true);
    const button = editButton('Unlocked record');
    expect(button).not.toBeNull();
    expect(button?.type).toBe('button');

    await act(async () => button!.click());
    expect(onEditRecord).toHaveBeenCalledTimes(1);
    expect(onEditRecord.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: UNLOCKED_ID, description: 'Unlocked record' }),
    );
    expect(onAncestorClick).not.toHaveBeenCalled();
  });

  it('keeps Diff and Deleted rows editable, as they are stored records', async () => {
    await render(true);
    expect(row('Diff record').textContent).toContain('Diff');
    expect(editButton('Diff record')).not.toBeNull();
    expect(row('Deleted record').textContent).toContain('Deleted');
    expect(editButton('Deleted record')).not.toBeNull();
  });

  it('shows no pencil on a locked row', async () => {
    await render(true);
    expect(editButton('Locked record')).toBeNull();
  });

  it('shows no pencil on a New (generated) row', async () => {
    await render(true);
    expect(row('New record').textContent).toContain('New');
    expect(editButton('New record')).toBeNull();
  });

  it('shows no actions at all without onEditRecord', async () => {
    await render(false);
    expect(container.querySelector('button[aria-label="Edit ledger record"]')).toBeNull();
    expect(container.querySelector('thead')?.textContent).not.toContain('Actions');
  });
});
