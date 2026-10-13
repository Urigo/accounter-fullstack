import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LedgerRecordForm } from '../index.js';
import type { LedgerRecordFormValues } from '../schema.js';

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

  beforeEach(async () => {
    onSubmit.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <Provider value={makeClient()}>
          <LedgerRecordForm mode="insert" submitting={false} onSubmit={onSubmit} />
        </Provider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['Debit', 'Credit'])('associates the %s label with its entity combobox', label => {
    const labelElement = Array.from(container.querySelectorAll('label')).find(
      element => element.textContent === label,
    );
    const target = labelElement?.htmlFor ? document.getElementById(labelElement.htmlFor) : null;
    expect(target?.tagName).toBe('BUTTON');
    expect(target?.textContent).toContain(`${label} entity`);
  });

  it('shows validation messages and does not submit an empty form', async () => {
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const messages = Array.from(container.querySelectorAll('[data-slot="form-message"]')).map(
      element => element.textContent,
    );
    expect(messages).toEqual(
      expect.arrayContaining(['Operation is required', 'Entity is required', 'Amount is required']),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
