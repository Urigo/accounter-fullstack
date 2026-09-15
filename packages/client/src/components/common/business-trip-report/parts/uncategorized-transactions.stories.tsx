import type { ReactElement } from 'react';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { map, pipe } from 'wonka';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BusinessTripUncategorizedTransactionsFieldsFragmentDoc } from '../../../../gql/graphql.js';
import type { FragmentType } from '../../../../gql/index.js';
import { UncategorizedTransactions } from './uncategorized-transactions.js';

/** Nothing here fetches on mount; the categorize dialog only queries once opened. */
const nullExchange: Exchange = () => operations$ =>
  pipe(
    operations$,
    map((operation): OperationResult => ({
      operation,
      data: null,
      error: undefined,
      extensions: undefined,
      hasNext: false,
      stale: false,
    })),
  );

function transaction(index: number, errors: string[] = []) {
  return {
    transaction: {
      id: `txn-${index}`,
      chargeId: `charge-${index}`,
      eventDate: `2026-09-0${index}`,
      effectiveDate: `2026-09-1${index}`,
      sourceEffectiveDate: `2026-09-1${index}`,
      amount: {
        raw: index % 2 ? 1240.5 : -820.25,
        formatted: index % 2 ? '$1,240.50' : '-$820.25',
      },
      account: { id: `acct-${index}`, name: `Isracard ••482${index}`, type: 'CREDIT_CARD' },
      sourceDescription: `AIRLINE TICKET ${index} / SFO`,
      referenceKey: `REF-00${index}`,
      counterparty: { id: `cp-${index}`, name: 'United Airlines' },
      missingInfoSuggestions: null,
    },
    categorizedAmount: { raw: 0, formatted: '$0.00' },
    errors,
  };
}

/**
 * `getFragmentData` is identity at runtime, so plain objects stand in for the fragments.
 */
function trip(): FragmentType<typeof BusinessTripUncategorizedTransactionsFieldsFragmentDoc> {
  return {
    id: 'trip-1',
    uncategorizedTransactions: [
      transaction(1),
      transaction(2, [
        'No matching attendee for this transaction',
        'Amount exceeds the per-day cap',
      ]),
      transaction(3),
    ],
  } as unknown as FragmentType<typeof BusinessTripUncategorizedTransactionsFieldsFragmentDoc>;
}

/**
 * Covers the two things this table does that the other seven do not: it fills six of its nine
 * columns from the shared `transactions-table/cells-legacy` components, and it renders the
 * errors tooltip that replaced a Mantine hover `Popover`.
 */
function Harness(): ReactElement {
  // No MemoryRouter here: `.storybook/preview.tsx` already provides one globally, and
  // react-router throws on a nested <Router>.
  return (
    <Provider value={new Client({ url: '/graphql', exchanges: [nullExchange] })}>
      <div className="p-4">
        <UncategorizedTransactions data={trip()} onChange={() => void 0} />
      </div>
    </Provider>
  );
}

const meta = {
  title: 'BusinessTripReport/UncategorizedTransactions',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
