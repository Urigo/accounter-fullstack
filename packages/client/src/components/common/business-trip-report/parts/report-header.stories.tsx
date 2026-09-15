import type { ReactElement } from 'react';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { map, pipe } from 'wonka';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BusinessTripReportHeaderFieldsFragmentDoc } from '../../../../gql/graphql.js';
import type { FragmentType } from '../../../../gql/index.js';
import { ReportHeader } from './report-header.js';

/** Answers everything with null; nothing here fetches on mount. */
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

/**
 * `getFragmentData` is an identity function at runtime, so a plain object stands in for the
 * masked fragment.
 */
const TRIP = {
  id: 'trip-1',
  name: 'GraphQL Conf 2026 — San Francisco',
  dates: { start: '2026-09-08', end: '2026-09-14' },
  purpose: 'Speaking at GraphQL Conf and meeting the platform team',
  destination: { id: 'dest-1', name: 'San Francisco, USA' },
  accountantApproval: 'APPROVED',
} as unknown as FragmentType<typeof BusinessTripReportHeaderFieldsFragmentDoc>;

/**
 * Characterizes the header's grid, which replaced Mantine's `Grid`. Mantine's `Grid.Col`
 * breakpoints are min-width based on its own scale (md 992, lg 1200, xl 1408) and do not line
 * up with Tailwind's, so the columns use arbitrary `min-[…]` variants. Resize the preview
 * across those three thresholds: the five fields go 1 per row, then 2, then 4, then 6 — and
 * from 992px up "Description" moves to the end of the row.
 */
function Harness(): ReactElement {
  return (
    <Provider value={new Client({ url: '/graphql', exchanges: [nullExchange] })}>
      <div className="p-4">
        <ReportHeader data={TRIP} onChange={() => void 0} />
      </div>
    </Provider>
  );
}

const meta = {
  title: 'BusinessTripReport/ReportHeader',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
