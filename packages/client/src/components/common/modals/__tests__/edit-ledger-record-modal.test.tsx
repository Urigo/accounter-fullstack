import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Currency,
  type LedgerRecordInput,
  type LedgerRecordsTableFieldsFragment,
} from '../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../providers/user-provider.js';
import { EditLedgerRecordModal } from '../edit-ledger-record-modal.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const updateLedgerRecord =
  vi.fn<
    (variables: {
      ledgerRecordId: string;
      input: LedgerRecordInput;
    }) => Promise<{ record: { id: string } } | void>
  >();

vi.mock('../../../../hooks/use-update-ledger-record.js', () => ({
  useUpdateLedgerRecord: () => ({ fetching: false, updateLedgerRecord }),
}));

vi.mock('../../../../hooks/use-get-financial-entities.js', () => ({
  useGetFinancialEntities: () => ({
    fetching: false,
    refresh: () => void 0,
    financialEntities: [],
    selectableFinancialEntities: [
      { value: 'debit-entity', label: 'Debit Co' },
      { value: 'credit-entity', label: 'Credit Co' },
      { value: 'vat-entity', label: 'Input VAT' },
    ],
  }),
}));

// The Radix select can't be driven in happy-dom; a native select keeps the same contract
vi.mock('../../inputs/currency-input.js', () => ({
  CurrencyCodeInput: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string) => void;
  }): ReactElement => (
    <select
      data-testid="currency"
      value={value}
      onChange={event => onChange?.(event.target.value)}
    >
      {['ILS', 'USD', 'EUR'].map(code => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  ),
}));

const userContext = {
  username: 'tester',
  context: { defaultLocalCurrency: Currency.Ils, ledgerLock: '2026-01-31' },
} as unknown as UserInfo;

const account = (id: string, name: string) =>
  ({ __typename: 'LtdFinancialEntity', id, name }) as const;
const usd = (raw: number) => ({ raw, currency: Currency.Usd, formatted: `$${raw}` });
const ils = (raw: number) => ({ raw, formatted: `₪${raw}` });

/** A stored USD record on all four lines: an expense with input VAT on Debit 2 */
const RECORD: LedgerRecordsTableFieldsFragment = {
  id: 'record-1',
  locked: false,
  currency: Currency.Usd,
  invoiceDate: '2026-03-15',
  valueDate: '2026-03-16',
  description: 'Consulting',
  reference: null,
  debitAccount1: account('debit-entity', 'Debit Co'),
  creditAccount1: account('credit-entity', 'Credit Co'),
  debitAccount2: account('vat-entity', 'Input VAT'),
  creditAccount2: account('credit-entity', 'Credit Co'),
  localCurrencyDebitAmount1: ils(100),
  localCurrencyCreditAmount1: ils(100.01),
  localCurrencyDebitAmount2: ils(17.01),
  localCurrencyCreditAmount2: ils(17),
  debitAmount1: usd(27.03),
  creditAmount1: usd(27.03),
  debitAmount2: usd(4.6),
  creditAmount2: usd(4.59),
};

describe('EditLedgerRecordModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn<() => void>();
  const onDone = vi.fn<() => void>();

  beforeEach(() => {
    updateLedgerRecord.mockReset();
    onClose.mockReset();
    onDone.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function render(record: LedgerRecordsTableFieldsFragment | null): Promise<void> {
    await act(async () => {
      root.render(
        <UserContext.Provider value={{ userContext, setUserContext: () => void 0 }}>
          <EditLedgerRecordModal record={record} onClose={onClose} onDone={onDone} />
        </UserContext.Provider>,
      );
    });
  }

  const dialog = (): Element | null => document.querySelector('[role="dialog"]');
  const amountInput = (label: string): HTMLInputElement | null =>
    document.querySelector(`input[aria-label="${label}"]`);

  async function save(): Promise<void> {
    const button = dialog()?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(button?.textContent).toBe('Save');
    await act(async () => button!.click());
  }

  it('is closed without a record', async () => {
    await render(null);
    expect(dialog()).toBeNull();
  });

  it('prefills a foreign-currency four-line record and saves it back unchanged', async () => {
    updateLedgerRecord.mockResolvedValue({ record: { id: 'record-1' } });
    await render(RECORD);

    expect(dialog()).not.toBeNull();
    // Edit mode has no operation
    expect(dialog()?.textContent).not.toContain('Operation');
    expect(amountInput('Debit 2 amount')?.value).toBe('17.01');
    expect(amountInput('Credit 2 foreign amount')?.value).toBe('4.59');

    await save();
    expect(updateLedgerRecord).toHaveBeenCalledTimes(1);
    expect(updateLedgerRecord.mock.calls[0][0]).toEqual({
      ledgerRecordId: 'record-1',
      input: {
        currency: Currency.Usd,
        invoiceDate: '2026-03-15',
        valueDate: '2026-03-16',
        description: 'Consulting',
        reference: null,
        debitEntity1: 'debit-entity',
        debitLocalAmount1: 100,
        debitForeignAmount1: 27.03,
        creditEntity1: 'credit-entity',
        creditLocalAmount1: 100.01,
        creditForeignAmount1: 27.03,
        debitEntity2: 'vat-entity',
        debitLocalAmount2: 17.01,
        debitForeignAmount2: 4.6,
        creditEntity2: 'credit-entity',
        creditLocalAmount2: 17,
        creditForeignAmount2: 4.59,
      },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stays open when the server rejects the edit', async () => {
    updateLedgerRecord.mockResolvedValue(undefined);
    await render(RECORD);
    await save();

    expect(updateLedgerRecord).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it('blocks a record dated on or before the ledger lock', async () => {
    await render({ ...RECORD, invoiceDate: '2026-01-31' });
    await save();

    expect(updateLedgerRecord).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain('Date must be after 2026-01-31');
  });

  it('calls onClose when dismissed', async () => {
    await render(RECORD);
    const close = Array.from(dialog()?.querySelectorAll('button') ?? []).find(
      button => button.textContent?.trim() === 'Close',
    );
    expect(close).toBeDefined();
    await act(async () => close!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateLedgerRecord).not.toHaveBeenCalled();
  });
});
