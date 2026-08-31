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
function makeClient(
  operations: string[],
  responses: Record<string, (variables: Record<string, unknown>) => unknown>,
): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      operationName: string;
      variables?: Record<string, unknown>;
    };
    operations.push(body.operationName);
    const data = (responses[body.operationName] ?? (() => ({})))(body.variables ?? {});
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

  async function renderTable(client: Client, ...charges: ChargeFixture[]): Promise<void> {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Provider value={client}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw fixtures stand in for the masked fragments */}
            <ChargesTable data={charges as any} />
          </Provider>
        </MemoryRouter>,
      );
    });
  }

  /** The green "confirm suggestion" mini button rendered next to a missing-info cell. */
  function confirmButtons(): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('button.text-green-500')];
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

  /** The similar-charges dialog renders through a portal on `document.body`, not into `container`. */
  function dialog(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('[role="dialog"]');
  }

  function buttonByText(scope: ParentNode, text: string): HTMLElement | undefined {
    return [...scope.querySelectorAll<HTMLElement>('button')].find(
      element => element.textContent?.trim() === text,
    );
  }

  it('refreshes the other charges a similar-charges approval updated', async () => {
    const operations: string[] = [];
    const refetched: string[] = [];
    // Flipped by the batch mutation: until then the refetch answers with the pre-approval charge,
    // exactly as the server would.
    let approved = false;

    const client = makeClient(operations, {
      UpdateCharge: () => ({
        updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: { id: 'charge-1' } },
      }),
      // `charge-2` is a row in the table *and* a similar charge — the case that used to go stale.
      SimilarCharges: () => ({
        similarCharges: [
          {
            id: 'charge-2',
            __typename: 'CommonCharge',
            counterparty: { name: 'Acme', id: 'business-1' },
            minEventDate: '2024-01-02',
            minDebitDate: null,
            minDocumentsDate: null,
            totalAmount: { raw: -50, formatted: '-50 ILS' },
            vat: { raw: -7, formatted: '-7 ILS' },
            userDescription: null,
            tags: [],
            taxCategory: { id: 'tax-1', name: 'Expenses' },
            metadata: {
              transactionsCount: 1,
              documentsCount: 0,
              ledgerCount: 0,
              miscExpensesCount: 0,
            },
          },
        ],
      }),
      BatchUpdateCharges: () => {
        approved = true;
        return {
          batchUpdateCharges: {
            __typename: 'BatchUpdateChargesSuccessfulResult',
            charges: [{ id: 'charge-2' }],
          },
        };
      },
      RefetchChargeForChargesTable: variables => {
        const chargeId = String(variables.chargeId);
        refetched.push(chargeId);
        if (chargeId === 'charge-1') {
          return { charge: makeCharge({ userDescription: 'Confirmed description' }) };
        }
        return {
          charge: makeCharge({
            id: 'charge-2',
            userDescription: approved ? 'Confirmed description' : 'Stale description',
          }),
        };
      },
    });

    await renderTable(
      client,
      makeCharge({
        validationData: { missingInfo: ['DESCRIPTION'] },
        missingInfoSuggestions: { description: 'Suggested description', tags: [] },
      }),
      makeCharge({ id: 'charge-2', userDescription: 'Stale description' }),
    );

    // Confirming charge-1's suggestion refreshes its own row and opens the similar-charges dialog.
    await click(confirmButtons()[0]);
    expect(container.textContent).toContain('Confirmed description');
    expect(container.textContent).toContain('Stale description');

    const modal = dialog();
    expect(modal).not.toBeNull();

    // The header checkbox selects every charge the dialog is offering — here, just charge-2.
    const selectAll = modal!.querySelector<HTMLElement>('[role="checkbox"]');
    expect(selectAll).not.toBeNull();
    await click(selectAll!);

    const approve = buttonByText(modal!, 'Approve selected');
    expect(approve).toBeDefined();
    await click(approve!);

    expect(operations).toContain('BatchUpdateCharges');
    // The approval only ever touched charge-2, so that is the row that had to be refreshed.
    expect(refetched.filter(id => id === 'charge-2')).not.toHaveLength(0);
    expect(container.textContent).not.toContain('Stale description');
  });

  it('leaves charges that are not in the table alone', async () => {
    const operations: string[] = [];
    const refetched: string[] = [];

    const client = makeClient(operations, {
      UpdateCharge: () => ({
        updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: { id: 'charge-1' } },
      }),
      SimilarCharges: () => ({
        similarCharges: [
          {
            id: 'charge-elsewhere',
            __typename: 'CommonCharge',
            counterparty: { name: 'Acme', id: 'business-1' },
            minEventDate: '2024-01-02',
            minDebitDate: null,
            minDocumentsDate: null,
            totalAmount: { raw: -50, formatted: '-50 ILS' },
            vat: { raw: -7, formatted: '-7 ILS' },
            userDescription: null,
            tags: [],
            taxCategory: { id: 'tax-1', name: 'Expenses' },
            metadata: {
              transactionsCount: 1,
              documentsCount: 0,
              ledgerCount: 0,
              miscExpensesCount: 0,
            },
          },
        ],
      }),
      BatchUpdateCharges: () => ({
        batchUpdateCharges: {
          __typename: 'BatchUpdateChargesSuccessfulResult',
          charges: [{ id: 'charge-elsewhere' }],
        },
      }),
      RefetchChargeForChargesTable: variables => {
        refetched.push(String(variables.chargeId));
        return { charge: makeCharge({ userDescription: 'Confirmed description' }) };
      },
    });

    await renderTable(
      client,
      makeCharge({
        validationData: { missingInfo: ['DESCRIPTION'] },
        missingInfoSuggestions: { description: 'Suggested description', tags: [] },
      }),
    );

    await click(confirmButtons()[0]);

    const modal = dialog();
    expect(modal).not.toBeNull();
    await click(modal!.querySelector<HTMLElement>('[role="checkbox"]')!);
    await click(buttonByText(modal!, 'Approve selected')!);

    expect(operations).toContain('BatchUpdateCharges');
    // Only charge-1's own post-mutation refresh; the approved charge isn't rendered anywhere.
    expect(refetched).not.toContain('charge-elsewhere');
  });
});
