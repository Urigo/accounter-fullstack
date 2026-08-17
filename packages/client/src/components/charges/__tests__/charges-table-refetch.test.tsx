// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChargesTable } from '../charges-table.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ChargeFixture = ReturnType<typeof makeCharge>;

function makeCharge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'charge-1',
    __typename: 'CommonCharge',
    minEventDate: '2024-01-01',
    minDebitDate: null,
    minDocumentsDate: null,
    maxDebitDate: null,
    maxEventDate: '2024-01-01',
    maxDocumentsDate: null,
    totalAmount: { raw: -100, currency: 'ILS' },
    vat: { raw: -15 },
    counterparty: { name: 'Acme', id: 'business-1' },
    userDescription: null as string | null,
    tags: [{ id: 'tag-1', name: 'Office', namePath: null }],
    taxCategory: { id: 'tax-1', name: 'Expenses' },
    metadata: {
      __typename: 'ChargeMetadata',
      transactionsCount: 1,
      documentsCount: 1,
      ledgerCount: 0,
      miscExpensesCount: 0,
      invalidLedger: null,
    },
    accountantApproval: 'UNAPPROVED',
    validationData: { missingInfo: [] as string[] },
    missingInfoSuggestions: { description: null as string | null, tags: [] },
    ...overrides,
  };
}

/** Builds an urql client backed by a scripted, request-recording fetch. */
function makeClient(operations: string[], responses: Record<string, () => unknown>): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { operationName: string };
    operations.push(body.operationName);
    const data = (responses[body.operationName] ?? (() => ({})))();
    const payload = JSON.stringify({ data });
    return {
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => payload,
      json: async () => JSON.parse(payload),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return new Client({
    url: 'http://localhost/graphql',
    exchanges: [fetchExchange],
    fetch: mockFetch,
    // Keep every operation on POST so the harness can read the body.
    preferGetMethod: false,
  });
}

describe('charges table row refetch', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function flush(times = 6): Promise<void> {
    for (let i = 0; i < times; i++) {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }

  async function renderTable(client: Client, charge: ChargeFixture): Promise<void> {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Provider value={client}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw fixture stands in for the masked fragment */}
            <ChargesTable data={[charge as any]} />
          </Provider>
        </MemoryRouter>,
      );
    });
  }

  /**
   * The "accept suggestion" control rendered beside a suggested description or tags. Matched on its
   * accessible name rather than a colour class: the record's accept button replaced the old
   * `ConfirmMiniButton`, and a name is what the affordance actually promises a user.
   */
  function confirmButtons(): HTMLElement[] {
    // Description reads `Accept suggested description "..."`, tags `Accept N suggested tag(s)`.
    return [...container.querySelectorAll<HTMLElement>('[aria-label^="Accept"]')];
  }

  async function click(element: HTMLElement): Promise<void> {
    await act(async () => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
  }

  it('refetches the charge and repaints the row after a description suggestion is confirmed', async () => {
    const operations: string[] = [];
    const client = makeClient(operations, {
      UpdateCharge: () => ({
        updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: { id: 'charge-1' } },
      }),
      SimilarCharges: () => ({ similarCharges: [] }),
      RefetchChargeForChargesTable: () => ({
        charge: makeCharge({ userDescription: 'Confirmed description' }),
      }),
    });

    await renderTable(
      client,
      makeCharge({
        validationData: { missingInfo: ['DESCRIPTION'] },
        missingInfoSuggestions: { description: 'Suggested description', tags: [] },
      }),
    );

    expect(container.textContent).toContain('Suggested description');

    const [confirm] = confirmButtons();
    expect(confirm).toBeDefined();
    await click(confirm);

    expect(operations).toContain('UpdateCharge');
    expect(operations).toContain('RefetchChargeForChargesTable');
    expect(container.textContent).toContain('Confirmed description');
    expect(container.textContent).not.toContain('Suggested description');
  });

  it('keeps the row refetchable after the row data was replaced by an earlier refetch', async () => {
    const operations: string[] = [];
    let refetchCount = 0;
    const client = makeClient(operations, {
      UpdateCharge: () => ({
        updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: { id: 'charge-1' } },
      }),
      SimilarCharges: () => ({ similarCharges: [] }),
      RefetchChargeForChargesTable: () => {
        refetchCount += 1;
        return refetchCount === 1
          ? {
              charge: makeCharge({
                userDescription: 'Confirmed description',
                tags: [],
                validationData: { missingInfo: ['TAGS'] },
                missingInfoSuggestions: {
                  description: null,
                  tags: [{ id: 'tag-9', name: 'Suggested tag', namePath: null }],
                },
              }),
            }
          : {
              charge: makeCharge({
                userDescription: 'Confirmed description',
                tags: [{ id: 'tag-9', name: 'Suggested tag', namePath: null }],
              }),
            };
      },
    });

    await renderTable(
      client,
      makeCharge({
        tags: [],
        validationData: { missingInfo: ['DESCRIPTION', 'TAGS'] },
        missingInfoSuggestions: {
          description: 'Suggested description',
          tags: [{ id: 'tag-9', name: 'Suggested tag', namePath: null }],
        },
      }),
    );

    // Confirm the description suggestion (first green button, Description column).
    await click(confirmButtons()[0]);
    expect(refetchCount).toBe(1);
    expect(container.textContent).toContain('Confirmed description');

    // Second action on the same row: `updateCharge` swapped the row object for a fresh one whose
    // `onChange` is an inert stub, so this only refetches if the handler was re-threaded.
    const remaining = confirmButtons();
    expect(remaining).toHaveLength(1);
    await click(remaining[0]);
    expect(refetchCount).toBe(2);
    expect(confirmButtons()).toHaveLength(0);
  });
});
