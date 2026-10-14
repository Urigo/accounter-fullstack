import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../../providers/user-provider.js';
import { LedgerRecordForm } from '../index.js';
import type { LedgerRecordFormInput, LedgerRecordFormValues } from '../schema.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DEBIT_ENTITY = 'debit-entity';
const CREDIT_ENTITY = 'credit-entity';

vi.mock('../../../../../hooks/use-get-financial-entities.js', () => ({
  useGetFinancialEntities: () => ({
    fetching: false,
    refresh: () => void 0,
    financialEntities: [],
    selectableFinancialEntities: [
      { value: 'debit-entity', label: 'Debit Co' },
      { value: 'credit-entity', label: 'Credit Co' },
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
  operation: LedgerRecordOperation.MiscExpense,
  invoiceDate: '2026-03-15',
  valueDate: '2026-03-16',
  debitEntity1: DEBIT_ENTITY,
  debitLocalAmount1: 100,
  creditEntity1: CREDIT_ENTITY,
  creditLocalAmount1: 100,
};

describe('LedgerRecordForm currency', () => {
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

  const currencySelect = (): HTMLSelectElement =>
    container.querySelector('[data-testid="currency"]') as HTMLSelectElement;
  const foreignInput = (side: 'Debit' | 'Credit'): HTMLInputElement | null =>
    container.querySelector(`input[aria-label="${side} foreign amount"]`);

  async function selectCurrency(code: string): Promise<void> {
    await act(async () => {
      const select = currencySelect();
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
    await act(async () => {
      (container.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    });
  }

  it('defaults to the local currency, without foreign amounts', async () => {
    await render(BASE_VALUES);
    expect(currencySelect().value).toBe(Currency.Ils);
    expect(foreignInput('Debit')).toBeNull();
    expect(foreignInput('Credit')).toBeNull();

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].currency).toBe(Currency.Ils);
  });

  it('shows foreign amounts for a foreign currency and requires them', async () => {
    await render(BASE_VALUES);
    await selectCurrency(Currency.Usd);
    expect(foreignInput('Debit')).not.toBeNull();
    expect(foreignInput('Credit')).not.toBeNull();

    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Foreign amount is required for USD records');
  });

  it('submits a foreign-currency record with its foreign amounts', async () => {
    await render({
      ...BASE_VALUES,
      currency: Currency.Usd,
      debitForeignAmount1: 27,
      creditForeignAmount1: 27,
    });
    expect(foreignInput('Debit')?.value).toBe('27');

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        currency: Currency.Usd,
        debitForeignAmount1: 27,
        creditForeignAmount1: 27,
      }),
    );
  });

  it('clears typed foreign amounts when switching back to the local currency', async () => {
    await render(BASE_VALUES);
    await selectCurrency(Currency.Usd);
    await type(foreignInput('Debit'), '27');
    await type(foreignInput('Credit'), '27');

    await selectCurrency(Currency.Ils);
    expect(foreignInput('Debit')).toBeNull();

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.currency).toBe(Currency.Ils);
    expect(submitted.debitForeignAmount1).toBeNull();
    expect(submitted.creditForeignAmount1).toBeNull();

    // Back in a foreign currency, the typed values do not come back
    await selectCurrency(Currency.Eur);
    expect(foreignInput('Debit')?.value).toBe('');
    expect(foreignInput('Credit')?.value).toBe('');
  });

  it('typing a foreign amount reaches the submitted values', async () => {
    await render(BASE_VALUES);
    await selectCurrency(Currency.Usd);
    await type(foreignInput('Debit'), '27.5');
    await type(foreignInput('Credit'), '27.5');

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ debitForeignAmount1: 27.5, creditForeignAmount1: 27.5 }),
    );
  });

  it('clears prefilled foreign amounts in the local currency, and shows what it sends', async () => {
    await render({
      ...BASE_VALUES,
      currency: Currency.Usd,
      debitForeignAmount1: 27,
      creditForeignAmount1: 27,
    });

    await selectCurrency(Currency.Ils);
    await submit();
    expect(onSubmit.mock.calls[0][0].debitForeignAmount1).toBeNull();
    expect(onSubmit.mock.calls[0][0].creditForeignAmount1).toBeNull();

    // The cleared values stay cleared when the inputs re-mount in a foreign currency (react-hook-
    // form would re-apply the prefilled defaults to an `undefined` field); what is shown is
    // exactly what is submitted
    await selectCurrency(Currency.Eur);
    expect(foreignInput('Debit')?.value).toBe('');
    expect(foreignInput('Credit')?.value).toBe('');
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Foreign amount is required for EUR records');
  });

  it('drops foreign-amount errors when switching back to the local currency', async () => {
    await render(BASE_VALUES);
    await selectCurrency(Currency.Usd);
    await submit();
    expect(container.textContent).toContain('Foreign amount is required');

    await selectCurrency(Currency.Ils);
    expect(container.textContent).not.toContain('Foreign amount is required');
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
