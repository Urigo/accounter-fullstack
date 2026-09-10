import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BusinessTripReportSummaryFieldsFragmentDoc } from '../../../../gql/graphql.js';
import type { FragmentType } from '../../../../gql/index.js';
import { Summary } from './summary.js';

const money = (formatted: string) => ({ formatted });

const ROWS = [
  {
    type: 'FLIGHT',
    totalForeignCurrency: money('$2,400.00'),
    totalLocalCurrency: money('₪8,880.00'),
    taxableForeignCurrency: money('$2,400.00'),
    taxableLocalCurrency: money('₪8,880.00'),
    maxTaxableForeignCurrency: money('$3,000.00'),
    maxTaxableLocalCurrency: money('₪11,100.00'),
    excessExpenditure: money('$0.00'),
  },
  {
    type: 'ACCOMMODATION',
    totalForeignCurrency: money('$1,800.00'),
    totalLocalCurrency: money('₪6,660.00'),
    taxableForeignCurrency: money('$1,400.00'),
    taxableLocalCurrency: money('₪5,180.00'),
    maxTaxableForeignCurrency: money('$1,400.00'),
    maxTaxableLocalCurrency: money('₪5,180.00'),
    excessExpenditure: money('$400.00'),
  },
  {
    type: 'TRAVEL_AND_SUBSISTENCE',
    totalForeignCurrency: money('$960.00'),
    totalLocalCurrency: money('₪3,552.00'),
    taxableForeignCurrency: money('$120.00'),
    taxableLocalCurrency: money('₪444.00'),
    maxTaxableForeignCurrency: money('$120.00'),
    maxTaxableLocalCurrency: money('₪444.00'),
    excessExpenditure: money('$840.00'),
  },
];

/** `getFragmentData` is identity at runtime, so a plain object stands in for the fragment. */
function trip({
  errors,
  loading,
}: {
  errors?: string[];
  loading?: boolean;
}): FragmentType<typeof BusinessTripReportSummaryFieldsFragmentDoc> {
  return {
    id: 'trip-1',
    summary: loading
      ? null
      : {
          excessExpenditure: money('$1,240.00'),
          excessTax: 30,
          errors: errors ?? null,
          rows: ROWS,
        },
  } as unknown as FragmentType<typeof BusinessTripReportSummaryFieldsFragmentDoc>;
}

/**
 * The summary table, moved off Mantine's `Table` onto `ui/table`. Also covers the `Paper`
 * error panel and the `Grid` footer, which were the only ones of their kind in this directory.
 *
 * Wrapped in a harness because `Summary`'s own `Props` type is not exported, so a
 * `Meta<typeof Summary>` cannot name it.
 */
function Harness({ errors, loading = false }: { errors?: string[]; loading?: boolean }) {
  return (
    <div className="p-4">
      <Summary data={trip({ errors, loading })} />
    </div>
  );
}

const meta = {
  title: 'BusinessTripReport/Summary',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

/** The `Paper` panel, now a `Card`, listing whatever the server could not reconcile. */
export const WithErrors: Story = {
  args: {
    errors: [
      'Flight expense 8f2c has no attendees',
      'Accommodation expense 1a90 is missing a country',
    ],
  },
};

/** The deferred fragment has not resolved yet. */
export const Loading: Story = { args: { loading: true } };
