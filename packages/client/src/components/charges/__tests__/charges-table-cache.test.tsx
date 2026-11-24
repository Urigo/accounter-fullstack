// @vitest-environment happy-dom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Client, fetchExchange, Provider, useQuery } from 'urql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AllChargesDocument } from '../../../gql/graphql.js';
import { chargesCacheExchange } from '../../../providers/urql-cache.js';
import { ChargesTable } from '../charges-table.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The charges table fed by the All Charges query, on a client with the cache: what an edit in a
// row costs in requests, and that the row shows it. `charges-table-refetch.test.tsx` covers a
// table whose list is not cached.

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
    totalAmount: { __typename: 'FinancialAmount', raw: -100, currency: 'ILS' },
    vat: { __typename: 'FinancialAmount', raw: -15 },
    counterparty: { __typename: 'LtdFinancialEntity', name: 'Acme', id: 'business-1' },
    userDescription: 'Rent',
    tags: [] as unknown[],
    taxCategory: { __typename: 'TaxCategory', id: 'tax-1', name: 'Expenses' },
    metadata: {
      __typename: 'ChargeMetadata',
      transactionsCount: 1,
      documentsCount: 1,
      ledgerCount: 0,
      miscExpensesCount: 0,
      depreciationRecordsCount: 0,
    },
    accountantApproval: 'UNAPPROVED',
    validationData: { __typename: 'ValidationData', missingInfo: ['TAGS'] },
    ...overrides,
  };
}

const SUGGESTED_TAG = { __typename: 'Tag', id: 'tag-9', name: 'Suggested tag', namePath: null };

const LIST_VARIABLES = { page: 0, limit: 100, filters: {} };

function ListScreen(): ReactElement {
  const [{ data }] = useQuery({
    query: AllChargesDocument,
    variables: LIST_VARIABLES,
    requestPolicy: 'network-only',
  });
  return <ChargesTable data={data?.allCharges.nodes} />;
}

describe('charges table on the cached All Charges list', () => {
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

  it('shows accepted tags from the save itself, with no refetch of the row', async () => {
    const operations: string[] = [];
    const responses: Record<string, () => unknown> = {
      AllCharges: () => ({
        allCharges: {
          __typename: 'PaginatedCharges',
          nodes: [
            {
              ...makeCharge(),
              metadata: { ...makeCharge().metadata, invalidLedger: 'VALID' },
              missingInfoSuggestions: {
                __typename: 'ChargeSuggestions',
                description: null,
                tags: [SUGGESTED_TAG],
              },
            },
          ],
          pageInfo: { __typename: 'PageInfo', totalPages: 1 },
        },
      }),
      UpdateCharge: () => ({
        updateCharge: {
          __typename: 'UpdateChargeSuccessfulResult',
          charge: makeCharge({
            tags: [SUGGESTED_TAG],
            validationData: { __typename: 'ValidationData', missingInfo: [] },
          }),
        },
      }),
      SimilarCharges: () => ({ similarCharges: [] }),
      AllTags: () => ({ allTags: [] }),
    };
    const scriptedFetch = (async (_url: string, init: RequestInit) => {
      const { operationName } = JSON.parse(String(init.body)) as { operationName: string };
      operations.push(operationName);
      const payload = JSON.stringify({ data: responses[operationName]?.() });
      return {
        status: 200,
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => payload,
        json: async () => JSON.parse(payload),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const client = new Client({
      url: 'http://localhost/graphql',
      exchanges: [chargesCacheExchange(), fetchExchange],
      fetch: scriptedFetch,
      preferGetMethod: false,
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <Provider value={client}>
            <ListScreen />
          </Provider>
        </MemoryRouter>,
      );
    });
    await flush();

    // The green "confirm suggestion" button next to the missing tags.
    const confirm = container.querySelector<HTMLElement>('button.text-green-500');
    expect(confirm).not.toBeNull();
    await act(async () => {
      confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('Suggested tag');
    // Accepted, so no longer offered.
    expect(container.querySelector('button.text-green-500')).toBeNull();
    // Besides the lookups around the table: the tag list its batch menu loads, and the
    // similar-charges dialog a save opens.
    const lookups = ['AllTags', 'SimilarCharges'];
    expect(operations.filter(name => !lookups.includes(name))).toEqual([
      'AllCharges',
      'UpdateCharge',
    ]);
  });
});
