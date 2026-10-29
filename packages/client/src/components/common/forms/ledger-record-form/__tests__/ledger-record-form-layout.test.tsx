import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../../../../gql/graphql.js';
import { UserContext, type UserInfo } from '../../../../../providers/user-provider.js';
import { LedgerRecordForm } from '../index.js';
import type { LedgerRecordFormInput, LedgerRecordFormValues } from '../schema.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LONG_NAME = 'ACCUMULUS FUND(USD) SERIES1 NEW (ACCU ISSUE)';

vi.mock('../../../../../hooks/use-get-financial-entities.js', () => ({
  useGetFinancialEntities: () => ({
    fetching: false,
    refresh: () => void 0,
    financialEntities: [],
    selectableFinancialEntities: [
      { value: 'debit-entity', label: 'Consulting Expenses' },
      { value: 'credit-entity', label: 'ACCUMULUS FUND(USD) SERIES1 NEW (ACCU ISSUE)' },
      { value: 'vat-entity', label: 'Input VAT' },
    ],
  }),
}));

// The Radix select can't be driven in happy-dom; a native select keeps the same contract and
// exposes the layout classes the form passes
vi.mock('../../../inputs/currency-input.js', () => ({
  CurrencyCodeInput: ({
    value,
    onChange,
    className,
    triggerClassName,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
    triggerClassName?: string;
  }): ReactElement => (
    <select
      data-testid="currency"
      data-class-name={className}
      data-trigger-class-name={triggerClassName}
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

/** The user's report: a USD record whose credit entity has a long name */
const USD_VALUES: LedgerRecordFormInput = {
  operation: LedgerRecordOperation.MiscExpense,
  currency: Currency.Usd,
  invoiceDate: '2026-02-10',
  valueDate: '2026-02-10',
  debitEntity1: 'debit-entity',
  debitLocalAmount1: 370,
  debitForeignAmount1: 100,
  creditEntity1: 'credit-entity',
  creditLocalAmount1: 370,
  creditForeignAmount1: 100,
};

describe('LedgerRecordForm layout', () => {
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
            mode="edit"
            defaultValues={defaultValues}
            submitting={false}
            onSubmit={onSubmit}
          />
        </UserContext.Provider>,
      );
    });
  }

  /** The entity picker labelled `label` */
  function entityTrigger(label: string): HTMLButtonElement {
    const labelElement = Array.from(container.querySelectorAll('label')).find(
      element => element.textContent === label,
    );
    const trigger = document.getElementById(labelElement?.getAttribute('for') ?? '');
    expect(trigger).not.toBeNull();
    return trigger as HTMLButtonElement;
  }

  const options = (): string[] =>
    [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].map(item => item.textContent ?? '');

  async function pickOption(label: string, option: string): Promise<void> {
    await act(async () => entityTrigger(label).click());
    const item = [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].find(
      element => element.textContent === option,
    );
    expect(item).toBeDefined();
    await act(async () => item!.click());
  }

  async function selectCurrency(code: string): Promise<void> {
    await act(async () => {
      const select = container.querySelector('[data-testid="currency"]') as HTMLSelectElement;
      select.value = code;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function submit(): Promise<void> {
    await act(async () => {
      (container.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    });
  }

  it('makes the currency select as wide as the other inputs, without the label-row margin', async () => {
    await render(USD_VALUES);
    const currency = container.querySelector('[data-testid="currency"]') as HTMLElement;
    expect(currency.dataset.className).toBe('mt-0');
    expect(currency.dataset.triggerClassName).toBe('w-full');
  });

  it('keeps a long entity name inside its column, with the full name on hover', async () => {
    await render(USD_VALUES);
    const trigger = entityTrigger('Credit');
    expect(trigger.textContent).toBe(LONG_NAME);
    expect(trigger.title).toBe(LONG_NAME);
    // No minimum width that would overflow a narrow (four-column) row...
    expect(trigger.className).toContain('min-w-0');
    expect(trigger.className).not.toContain('min-w-40');
    // ...and every cell's own grid is capped to its share of the row (minmax(0, 1fr)), so the
    // name truncates instead of widening the cell over the amounts
    const row = trigger.closest('[data-slot="form-item"]')?.parentElement;
    const cells = [...(row?.querySelectorAll(':scope > [data-slot="form-item"]') ?? [])];
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.className).toContain('grid-cols-1');
      expect(cell.className).toContain('min-w-0');
    }
  });

  it('marks the foreign amounts with the record currency symbol', async () => {
    await render(USD_VALUES);
    const symbols = (): string[] =>
      [...container.querySelectorAll('[data-testid="foreign-currency-symbol"]')].map(
        symbol => symbol.textContent ?? '',
      );
    expect(symbols()).toEqual(['$', '$', '$', '$']);

    await selectCurrency(Currency.Eur);
    expect(symbols()).toEqual(['€', '€', '€', '€']);

    // The local currency has no foreign amounts, so no symbols
    await selectCurrency(Currency.Ils);
    expect(symbols()).toEqual([]);
  });

  it('hides the symbol from assistive tech and pads the input for its length', async () => {
    const foreignInput = (): HTMLInputElement =>
      container.querySelector('input[aria-label="Credit foreign amount"]') as HTMLInputElement;
    const symbol = (): HTMLElement =>
      foreignInput()
        .closest('[data-slot="form-item"]')
        ?.querySelector('[data-testid="foreign-currency-symbol"]') as HTMLElement;

    // One character: $
    await render(USD_VALUES);
    expect(symbol().textContent).toBe('$');
    expect(symbol().getAttribute('aria-hidden')).toBe('true');
    expect(foreignInput().className).toContain('pe-8');
    await act(async () => root.unmount());

    // Two characters: C$
    root = createRoot(container);
    await render({ ...USD_VALUES, currency: Currency.Cad });
    expect(symbol().textContent).toBe('C$');
    expect(foreignInput().className).toContain('pe-10');
    expect(foreignInput().className).not.toContain('pe-8');
    await act(async () => root.unmount());

    // Four characters: USDC
    root = createRoot(container);
    await render({ ...USD_VALUES, currency: Currency.Usdc });
    expect(symbol().textContent).toBe('USDC');
    expect(foreignInput().className).toContain('pe-14');
  });

  it('lets a secondary entity be unpicked with "None"', async () => {
    await render(USD_VALUES);
    await pickOption('Credit 2', 'Input VAT');
    expect(entityTrigger('Credit 2').textContent).toBe('Input VAT');

    await pickOption('Credit 2', 'None');
    expect(entityTrigger('Credit 2').textContent).toBe('Credit 2 entity');

    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].creditEntity2 || null).toBeNull();
  });

  it('keeps the amounts of an unpicked line, and asks for an entity for them', async () => {
    await render({
      ...USD_VALUES,
      debitLocalAmount1: 353,
      debitEntity2: 'vat-entity',
      debitLocalAmount2: 17,
      debitForeignAmount2: 4.6,
    });
    await pickOption('Debit 2', 'None');

    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Entity is required when an amount is entered');
  });

  it('does not offer "None" on the required main lines', async () => {
    await render(USD_VALUES);
    await act(async () => entityTrigger('Credit').click());
    expect(options()).not.toContain('None');
    expect(options()).toContain(LONG_NAME);
  });
});
