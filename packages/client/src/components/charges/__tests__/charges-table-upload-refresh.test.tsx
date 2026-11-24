import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargesTable } from '../charges-table.js';

// The upload itself is multipart, which the JSON-only fetch harness below can't read — stub the
// hook and let the rest of the table run against the scripted client.
const uploadMultipleDocuments = vi.fn<(variables: unknown) => Promise<unknown[] | void>>();
vi.mock('../../../hooks/use-upload-multiple-documents.js', () => ({
  useUploadMultipleDocuments: () => ({ uploading: false, uploadMultipleDocuments }),
}));

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
      depreciationRecordsCount: 0,
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

describe('charges table refresh after a document upload', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    uploadMultipleDocuments.mockReset();
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

  async function renderTable(
    client: Client,
    charges: ChargeFixture[],
    isAllOpened = false,
  ): Promise<void> {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Provider value={client}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw fixtures stand in for the masked fragments */}
            <ChargesTable data={charges as any} isAllOpened={isAllOpened} />
          </Provider>
        </MemoryRouter>,
      );
    });
  }

  /** The "More Info" cell's drop target: the element wrapping the "Ledger Records" capsule. */
  function dropTarget(): HTMLElement {
    const label = [...container.querySelectorAll<HTMLElement>('div')].find(element =>
      element.textContent?.startsWith('Ledger Records:'),
    );
    const target = label?.closest<HTMLElement>('td')?.firstElementChild;
    if (!(target instanceof HTMLElement)) {
      throw new Error('more-info drop target not rendered');
    }
    return target;
  }

  async function dropFile(): Promise<void> {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' })] },
    });
    await act(async () => {
      dropTarget().dispatchEvent(event);
    });
    await flush();
  }

  async function click(button: HTMLElement): Promise<void> {
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
  }

  /** The button holding the given lucide icon (its `lucide-<name>` class). */
  function buttonWithIcon(icon: string): HTMLElement {
    const button = container.querySelector(`.lucide-${icon}`)?.closest<HTMLElement>('button');
    if (!button) {
      throw new Error(`button with the ${icon} icon not rendered`);
    }
    return button;
  }

  /** Clicks the row's expand toggle, which shows a different icon while collapsed and while open. */
  async function toggleRow(): Promise<void> {
    const toggle = container.querySelector('.lucide-panel-top-open')
      ? buttonWithIcon('panel-top-open')
      : buttonWithIcon('panel-top-close');
    await click(toggle);
  }

  /** Whether the row's expansion is rendered. */
  function isExpanded(): boolean {
    return !!container.querySelector('.lucide-panel-top-close');
  }

  const responses = (refetched: string[]) => ({
    RefetchChargeForChargesTable: (variables: Record<string, unknown>) => {
      refetched.push(String(variables.chargeId));
      return {
        charge: makeCharge({ metadata: { ...makeCharge().metadata, documentsCount: 2 } }),
      };
    },
    FetchCharge: () => ({ charge: makeCharge() }),
    ChargesExtendedInfoBatch: () => ({ chargesByIDs: [makeCharge()] }),
    UpdateCharge: () => ({
      updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: { id: 'charge-1' } },
    }),
    // Opened by the description cell after an edit; no matches closes it again.
    SimilarCharges: () => ({ similarCharges: [] }),
  });

  const batchFetches = (operations: string[]): number =>
    operations.filter(op => op === 'ChargesExtendedInfoBatch').length;

  it('refetches the row once documents dropped on it uploaded', async () => {
    uploadMultipleDocuments.mockResolvedValue([{ id: 'document-1' }]);
    const operations: string[] = [];
    const refetched: string[] = [];
    await renderTable(makeClient(operations, responses(refetched)), [makeCharge()]);

    expect(container.textContent).toContain('Documents: 1');
    await dropFile();

    expect(uploadMultipleDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ chargeId: 'charge-1' }),
    );
    expect(refetched).toEqual(['charge-1']);
    expect(container.textContent).toContain('Documents: 2');
  });

  it('does not refetch the row when the upload failed', async () => {
    uploadMultipleDocuments.mockResolvedValue(undefined);
    const operations: string[] = [];
    const refetched: string[] = [];
    await renderTable(makeClient(operations, responses(refetched)), [makeCharge()]);

    await dropFile();

    expect(uploadMultipleDocuments).toHaveBeenCalledTimes(1);
    expect(refetched).toEqual([]);
  });

  it('refetches an open expansion once, along with the row', async () => {
    uploadMultipleDocuments.mockResolvedValue([{ id: 'document-1' }]);
    const operations: string[] = [];
    const refetched: string[] = [];
    await renderTable(makeClient(operations, responses(refetched)), [makeCharge()]);

    await toggleRow();
    const expansionFetches = (): number => operations.filter(op => op === 'FetchCharge').length;
    const before = expansionFetches();
    expect(before).toBeGreaterThan(0);

    await dropFile();

    expect(refetched).toEqual(['charge-1']);
    // Exactly one refetch: the expansion follows the row refetch, without a duplicate of its own.
    expect(expansionFetches()).toBe(before + 1);
  });

  it('refetches the batched expansion in expand-all mode', async () => {
    uploadMultipleDocuments.mockResolvedValue([{ id: 'document-1' }]);
    const operations: string[] = [];
    const refetched: string[] = [];
    await renderTable(makeClient(operations, responses(refetched)), [makeCharge()], true);
    await flush();

    expect(batchFetches(operations)).toBe(1);
    // The batch loader replaces the per-row query.
    expect(operations).not.toContain('FetchCharge');

    await dropFile();

    expect(refetched).toEqual(['charge-1']);
    expect(batchFetches(operations)).toBe(2);
    expect(operations).not.toContain('FetchCharge');
  });

  it('refetches the batch for a drop on a row collapsed in expand-all mode', async () => {
    // Re-expanding the row reads the charge from the batch instead of fetching it, so the batch has
    // to follow the upload while the row is collapsed too.
    uploadMultipleDocuments.mockResolvedValue([{ id: 'document-1' }]);
    const operations: string[] = [];
    const refetched: string[] = [];
    await renderTable(makeClient(operations, responses(refetched)), [makeCharge()], true);
    await flush();

    await toggleRow();
    expect(isExpanded()).toBe(false);

    await dropFile();

    expect(refetched).toEqual(['charge-1']);
    expect(batchFetches(operations)).toBe(2);

    await toggleRow();
    expect(isExpanded()).toBe(true);
    expect(operations).not.toContain('FetchCharge');
  });

  it('refetches only the row after a description edit in expand-all mode', async () => {
    const operations: string[] = [];
    const refetched: string[] = [];
    const charge = makeCharge({
      validationData: { missingInfo: ['DESCRIPTION'] },
      missingInfoSuggestions: { description: 'Office supplies', tags: [] },
    });
    await renderTable(makeClient(operations, responses(refetched)), [charge], true);
    await flush();
    expect(batchFetches(operations)).toBe(1);

    // Accept the suggested description.
    const accept = [...container.querySelectorAll('p')]
      .find(element => element.textContent === 'Office supplies')
      ?.closest('td')
      ?.querySelector('.lucide-check')
      ?.closest<HTMLElement>('button');
    if (!accept) {
      throw new Error('suggested description not rendered');
    }
    await click(accept);

    expect(operations).toContain('UpdateCharge');
    expect(refetched).toEqual(['charge-1']);
    expect(batchFetches(operations)).toBe(1);
  });
});
