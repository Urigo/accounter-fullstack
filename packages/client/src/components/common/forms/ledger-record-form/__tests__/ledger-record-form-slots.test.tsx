import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../../providers/user-provider.js';
import { LedgerRecordForm } from '../index.js';
import type { LedgerRecordFormInput, LedgerRecordFormValues } from '../schema.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../../hooks/use-get-financial-entities.js', () => ({
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
vi.mock('../../../inputs/currency-input.js', () => ({
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
  context: { defaultLocalCurrency: Currency.Ils, ledgerLock: null },
} as unknown as UserInfo;

const BASE_VALUES: LedgerRecordFormInput = {
  operation: LedgerRecordOperation.Document,
  invoiceDate: '2026-03-15',
  valueDate: '2026-03-16',
  debitEntity1: 'debit-entity',
  debitLocalAmount1: 100,
  creditEntity1: 'credit-entity',
  creditLocalAmount1: 100,
};

/** A foreign-currency record with both secondary lines filled, as an edit would prefill it */
const FULL_USD_VALUES: LedgerRecordFormInput = {
  ...BASE_VALUES,
  currency: Currency.Usd,
  debitForeignAmount1: 27,
  creditForeignAmount1: 27,
  debitEntity2: 'vat-entity',
  debitLocalAmount2: 17,
  debitForeignAmount2: 4.6,
  creditEntity2: 'credit-entity',
  creditLocalAmount2: 17,
  creditForeignAmount2: 4.6,
};

describe('LedgerRecordForm secondary lines', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn<(values: LedgerRecordFormValues) => void>();

  beforeEach(() => {
    onSubmit.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function render(defaultValues: LedgerRecordFormInput): Promise<void> {
    await act(async () => {
      root.render(
        <UserContext.Provider value={{ userContext, setUserContext: () => void 0 }}>
          <LedgerRecordForm
            mode="insert"
            defaultValues={defaultValues}
            submitting={false}
            onSubmit={onSubmit}
          />
        </UserContext.Provider>,
      );
    });
  }

  const amountInput = (label: string): HTMLInputElement | null =>
    container.querySelector(`input[aria-label="${label}"]`);

  /** The text of the entity picker labelled `label` (its selection, or its placeholder) */
  function entityText(label: string): string | null {
    const labelElement = Array.from(container.querySelectorAll('label')).find(
      element => element.textContent === label,
    );
    const id = labelElement?.getAttribute('for');
    return id ? (document.getElementById(id)?.textContent ?? null) : null;
  }

  const clearButton = (label: string): HTMLButtonElement | null =>
    container.querySelector(`button[aria-label="Clear ${label}"]`);

  async function click(element: HTMLElement | null): Promise<void> {
    expect(element).not.toBeNull();
    await act(async () => element!.click());
  }

  async function selectCurrency(code: string): Promise<void> {
    await act(async () => {
      const select = container.querySelector('[data-testid="currency"]') as HTMLSelectElement;
      select.value = code;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function type(input: HTMLInputElement | null, text: string): Promise<void> {
    expect(input).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, text);
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function submit(): Promise<void> {
    await click(container.querySelector('button[type="submit"]'));
  }

  const totals = (): string | null =>
    container.querySelector('[data-testid="ledger-totals"]')?.textContent ?? null;
  const difference = (): HTMLElement | null =>
    container.querySelector('[data-testid="ledger-difference"]');

  it('renders optional Debit 2 and Credit 2 lines and submits without them', async () => {
    await render(BASE_VALUES);
    expect(entityText('Debit 2')).toBe('Debit 2 entity');
    expect(entityText('Credit 2')).toBe('Credit 2 entity');
    expect(amountInput('Debit 2 amount')).not.toBeNull();
    expect(amountInput('Credit 2 amount')?.getAttribute('aria-required')).toBe('false');

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits a VAT-style record across four lines', async () => {
    await render({ ...BASE_VALUES, creditLocalAmount1: 117, debitEntity2: 'vat-entity' });
    await type(amountInput('Debit 2 amount'), '17');

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        debitEntity2: 'vat-entity',
        debitLocalAmount2: 17,
        creditLocalAmount1: 117,
      }),
    );
  });

  it('reports a secondary amount without an entity on the entity', async () => {
    await render({ ...BASE_VALUES, creditLocalAmount1: 117 });
    await type(amountInput('Debit 2 amount'), '17');

    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Entity is required when an amount is entered');
  });

  it('shows live totals, and colours an unbalanced difference', async () => {
    await render({ ...BASE_VALUES, creditLocalAmount1: 117, debitEntity2: 'vat-entity' });
    expect(totals()).toContain('Debit total100.00');
    expect(totals()).toContain('Credit total117.00');
    expect(difference()?.textContent).toBe('-17.00');
    expect(difference()?.className).toContain('text-destructive');

    await type(amountInput('Debit 2 amount'), '17');
    expect(totals()).toContain('Debit total117.00');
    expect(difference()?.textContent).toBe('0.00');
    expect(difference()?.className).not.toContain('text-destructive');
  });

  it('shows the balance error in the totals, together with other errors', async () => {
    await render({ ...BASE_VALUES, creditLocalAmount1: 99, valueDate: undefined });
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(totals()).toContain('Debit and credit totals must be equal');
    expect(container.textContent).toContain('Date is required');

    // Once the amounts balance again, the stale message is not shown
    await type(amountInput('Credit amount'), '100');
    expect(totals()).not.toContain('must be equal');
  });

  it('does not show the numbers of the last submit in the balance message', async () => {
    await render({ ...BASE_VALUES, creditLocalAmount1: 99 });
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    const alert = (): string | null =>
      container.querySelector('[data-testid="ledger-totals"] [role="alert"]')?.textContent ?? null;
    expect(alert()).toBe('Debit and credit totals must be equal');

    // Still unbalanced, with new totals: the message carries no stale numbers
    await type(amountInput('Credit amount'), '90');
    expect(alert()).toBe('Debit and credit totals must be equal');
    expect(totals()).not.toContain('99');
    expect(totals()).toContain('Credit total90.00');
  });

  it('keeps keyboard focus on × after clearing a line', async () => {
    await render(FULL_USD_VALUES);
    const button = clearButton('Debit 2');
    button!.focus();
    expect(document.activeElement).toBe(button);

    await click(button);
    expect(button!.isConnected).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(amountInput('Debit 2 amount')?.value).toBe('');
  });

  it('clears a secondary line with ×, and submits it cleared', async () => {
    await render(FULL_USD_VALUES);
    expect(entityText('Debit 2')).toBe('Input VAT');
    expect(amountInput('Debit 2 amount')?.value).toBe('17');
    expect(amountInput('Debit 2 foreign amount')?.value).toBe('4.6');

    await click(clearButton('Debit 2'));
    await click(clearButton('Credit 2'));
    expect(entityText('Debit 2')).toBe('Debit 2 entity');
    expect(amountInput('Debit 2 amount')?.value).toBe('');
    expect(amountInput('Debit 2 foreign amount')?.value).toBe('');
    expect(entityText('Credit 2')).toBe('Credit 2 entity');
    expect(amountInput('Credit 2 amount')?.value).toBe('');
    expect(amountInput('Credit 2 foreign amount')?.value).toBe('');

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        debitEntity2: null,
        debitLocalAmount2: null,
        debitForeignAmount2: null,
        creditEntity2: null,
        creditLocalAmount2: null,
        creditForeignAmount2: null,
      }),
    );
  });

  it('keeps a cleared line cleared when its inputs re-mount', async () => {
    await render(FULL_USD_VALUES);
    await click(clearButton('Debit 2'));
    await click(clearButton('Credit 2'));

    // The foreign inputs unmount in the local currency and re-mount in a foreign one; the
    // prefilled values must not come back
    await selectCurrency(Currency.Ils);
    await selectCurrency(Currency.Eur);
    expect(amountInput('Debit 2 foreign amount')?.value).toBe('');
    expect(amountInput('Credit 2 foreign amount')?.value).toBe('');
    expect(amountInput('Debit 2 amount')?.value).toBe('');

    // The round trip through the local currency cleared the main lines' foreign amounts too
    await type(amountInput('Debit foreign amount'), '25');
    await type(amountInput('Credit foreign amount'), '25');
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        currency: Currency.Eur,
        debitForeignAmount2: null,
        creditForeignAmount2: null,
      }),
    );
  });

  it('clears the errors of a cleared line', async () => {
    await render({ ...BASE_VALUES, creditLocalAmount1: 117 });
    await type(amountInput('Debit 2 amount'), '17');
    await submit();
    expect(container.textContent).toContain('Entity is required when an amount is entered');

    await click(clearButton('Debit 2'));
    expect(container.textContent).not.toContain('Entity is required when an amount is entered');
  });

  it('clears the secondary foreign amounts when switching to the local currency', async () => {
    await render(FULL_USD_VALUES);
    await selectCurrency(Currency.Ils);
    expect(amountInput('Debit 2 foreign amount')).toBeNull();

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.debitEntity2).toBe('vat-entity');
    expect(submitted.debitLocalAmount2).toBe(17);
    expect(submitted.debitForeignAmount2).toBeNull();
    expect(submitted.creditForeignAmount2).toBeNull();

    // Back in a foreign currency, the prefilled foreign amounts do not come back
    await selectCurrency(Currency.Usd);
    expect(amountInput('Debit 2 foreign amount')?.value).toBe('');
    expect(amountInput('Credit 2 foreign amount')?.value).toBe('');
  });
});
