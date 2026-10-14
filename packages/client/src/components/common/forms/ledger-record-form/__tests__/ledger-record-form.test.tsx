import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerRecordOperation } from '../../../../../gql/graphql.js';
import { LedgerRecordForm } from '../index.js';
import type { LedgerRecordFormInput, LedgerRecordFormValues } from '../schema.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeClient(): Client {
  const payload = JSON.stringify({ data: { allFinancialEntities: { nodes: [] } } });
  const mockFetch = (async () =>
    ({
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => payload,
      json: async () => JSON.parse(payload),
    }) as unknown as Response) as unknown as typeof fetch;
  return new Client({ url: 'http://localhost/graphql', exchanges: [fetchExchange], fetch: mockFetch });
}

describe('LedgerRecordForm', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSubmit = vi.fn<(values: LedgerRecordFormValues) => void>();

  async function render(defaultValues?: LedgerRecordFormInput): Promise<void> {
    await act(async () => {
      root.render(
        <Provider value={makeClient()}>
          <LedgerRecordForm
            mode="insert"
            submitting={false}
            onSubmit={onSubmit}
            defaultValues={defaultValues}
          />
        </Provider>,
      );
    });
  }

  async function submit(): Promise<void> {
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  }

  function formMessages(): Array<string | null> {
    return Array.from(container.querySelectorAll('[data-slot="form-message"]')).map(
      element => element.textContent,
    );
  }

  function inputLabelled(text: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find(
      element => element.textContent === text,
    );
    return document.getElementById(label!.htmlFor) as HTMLInputElement;
  }

  async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const VALID_DEFAULTS: LedgerRecordFormInput = {
    operation: LedgerRecordOperation.MiscExpense,
    invoiceDate: '2026-03-15',
    valueDate: '2026-03-16',
    debitEntity1: 'debit-entity',
    debitLocalAmount1: 100,
    creditEntity1: 'credit-entity',
    creditLocalAmount1: 100,
  };

  beforeEach(() => {
    onSubmit.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['Debit', 'Credit'])('associates the %s label with its entity combobox', async label => {
    await render();
    const labelElement = Array.from(container.querySelectorAll('label')).find(
      element => element.textContent === label,
    );
    const target = labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : null;
    expect(target?.tagName).toBe('BUTTON');
    expect(target?.textContent).toContain(`${label} entity`);
  });

  it('associates the Currency label with the currency select trigger', async () => {
    await render();
    const labelElement = Array.from(container.querySelectorAll('label')).find(
      element => element.textContent === 'Currency',
    );
    const target = labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : null;
    expect(target?.tagName).toBe('BUTTON');
    expect(target?.getAttribute('role')).toBe('combobox');
    expect(target?.textContent).toContain('ILS');
  });

  it('shows validation messages and does not submit an empty form', async () => {
    await render();
    await submit();

    expect(formMessages()).toEqual(
      expect.arrayContaining(['Operation is required', 'Entity is required', 'Amount is required']),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid record (control)', async () => {
    await render(VALID_DEFAULTS);
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ invoiceDate: '2026-03-15' });
  });

  it.each([
    ['Invoice date', 'invoiceDate'],
    ['Value date', 'valueDate'],
  ])(
    'blocks submit when a valid %s is edited to an invalid one',
    async (label, field) => {
      await render(VALID_DEFAULTS);
      const input = inputLabelled(label);
      expect(input.value).toBe(VALID_DEFAULTS[field as 'invoiceDate' | 'valueDate']);

      await typeInto(input, '2026-13-45');
      await submit();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(formMessages()).toContain('Date must be in format yyyy-mm-dd');
    },
  );

  it('submits again once the invalid date is corrected', async () => {
    await render(VALID_DEFAULTS);
    const input = inputLabelled('Invoice date');
    await typeInto(input, '2026-13-45');
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();

    await typeInto(input, '2026-04-01');
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ invoiceDate: '2026-04-01' });
    expect(formMessages()).not.toContain('Date must be in format yyyy-mm-dd');
  });

  it('blocks submit when a valid date is cleared', async () => {
    await render(VALID_DEFAULTS);
    await typeInto(inputLabelled('Invoice date'), '');
    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(formMessages()).toContain('Date is required');
  });
});
