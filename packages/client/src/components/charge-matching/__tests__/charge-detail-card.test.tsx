// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import type { ChargeMatchCardFieldsFragment } from '../../../gql/graphql.js';
import { ChargeDetailCard } from '../charge-detail-card.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeCharge(
  overrides: Partial<ChargeMatchCardFieldsFragment> = {},
): ChargeMatchCardFieldsFragment {
  return {
    __typename: 'CommonCharge',
    id: 'charge-1',
    minEventDate: '2024-03-15',
    minDebitDate: null,
    minDocumentsDate: null,
    totalAmount: {
      raw: 1234.56,
      // deliberately NOT a plain number rendering — the exact string must be shown as-is
      formatted: '₪1,234.56',
      currency: 'ILS',
    },
    counterparty: { id: 'business-1', name: 'Acme Ltd' },
    userDescription: 'Office supplies',
    additionalDocuments: [],
    transactions: [],
    miscExpenses: [],
    ...overrides,
  } as ChargeMatchCardFieldsFragment;
}

async function renderCard(props: React.ComponentProps<typeof ChargeDetailCard>) {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(ChargeDetailCard, props));
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, cleanup };
}

describe('ChargeDetailCard', () => {
  it('renders the exact formatted amount string with its currency symbol', async () => {
    const { container, cleanup } = await renderCard({
      charge: makeCharge(),
      title: 'Base Charge',
    });

    expect(container.textContent).toContain('₪1,234.56');
    expect(container.textContent).toContain('Acme Ltd');
    expect(container.textContent).toContain('Office supplies');

    await cleanup();
  });

  it('handles a missing document image gracefully without crashing', async () => {
    const { container, cleanup } = await renderCard({
      charge: makeCharge({ additionalDocuments: [] }),
      title: 'Base Charge',
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('No document preview');

    await cleanup();
  });

  it('renders a document image thumbnail when available', async () => {
    const { container, cleanup } = await renderCard({
      charge: makeCharge({
        additionalDocuments: [
          {
            id: 'doc-1',
            documentType: 'INVOICE',
            image: 'https://example.com/preview.png',
            file: null,
          },
        ],
      } as Partial<ChargeMatchCardFieldsFragment>),
      title: 'Base Charge',
    });

    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.com/preview.png');

    await cleanup();
  });

  it('renders a confidence score badge only when a score is provided', async () => {
    const withScore = await renderCard({
      charge: makeCharge(),
      title: 'Suggested Match',
      confidenceScore: 0.94,
    });
    expect(withScore.container.textContent).toContain('94');
    expect(
      withScore.container.querySelector('[aria-label="Match confidence score: 94%"]'),
    ).not.toBeNull();
    await withScore.cleanup();

    const withoutScore = await renderCard({ charge: makeCharge(), title: 'Base Charge' });
    expect(
      withoutScore.container.querySelector('[aria-label^="Match confidence score"]'),
    ).toBeNull();
    await withoutScore.cleanup();
  });
});
