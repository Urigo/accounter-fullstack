import { useState, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { map, never, pipe } from 'wonka';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChargeFilterType, ChargeType, type ChargeFilter } from '../../../gql/graphql.js';
import { UserContext } from '../../../providers/user-provider.js';
import { ChargesFilters } from './index.js';

/* -------------------------------------------------------------------------- */
/*  Mock backend                                                              */
/* -------------------------------------------------------------------------- */

/**
 * These stories use a local urql client rather than the preview's shared one, so
 * they render identical results without `yarn mock:server` running. Auto-mocked
 * data would also defeat the point here — the states below depend on knowing
 * exactly which entities exist and which ones the filter has selected.
 */
const OWNERS = [
  { id: 'owner-1', name: 'The Guild', governmentId: '111111111' },
  { id: 'owner-2', name: 'Guild Ventures', governmentId: '222222222' },
];

const FINANCIAL_ENTITIES = [
  'Google Ireland',
  'Amazon Web Services',
  'Bank Hapoalim',
  'Vercel',
  'Microsoft Azure',
  'GitHub',
  'Stripe',
  'Cloudflare',
  'DigitalOcean',
  'Twilio',
  'SendGrid',
  'מס הכנסה',
].map((name, index) => ({ id: `entity-${index}`, name }));

const FINANCIAL_ACCOUNTS = [
  { id: 'acct-1', name: 'Hapoalim 12-345', type: 'BANK_ACCOUNT' },
  { id: 'acct-2', name: 'Discount 67-890', type: 'BANK_ACCOUNT' },
  { id: 'acct-3', name: 'Isracard ••4821', type: 'CREDIT_CARD' },
  { id: 'acct-4', name: 'Amex ••7702', type: 'CREDIT_CARD' },
  { id: 'acct-5', name: 'Deposit 2026-A', type: 'BANK_DEPOSIT_ACCOUNT' },
  { id: 'acct-6', name: 'IBKR Securities', type: 'FOREIGN_SECURITIES' },
  { id: 'acct-7', name: 'ETH Wallet', type: 'CRYPTO_WALLET' },
];

const TAGS = [
  { id: 'tag-1', name: 'R&D', namePath: ['Expenses', 'R&D'] },
  { id: 'tag-2', name: 'Marketing', namePath: ['Expenses', 'Marketing'] },
  { id: 'tag-3', name: 'Travel', namePath: ['Expenses', 'Travel'] },
  { id: 'tag-4', name: 'Salaries', namePath: ['Expenses', 'Payroll', 'Salaries'] },
  { id: 'tag-5', name: 'Consulting', namePath: ['Income', 'Consulting'] },
];

const BUSINESS_TRIPS = [
  { id: 'trip-1', name: 'GraphQL Conf 2026' },
  { id: 'trip-2', name: 'React Summit 2026' },
  { id: 'trip-3', name: 'Team offsite' },
];

const RESPONSES: Record<string, unknown> = {
  AllAdminBusinesses: { allAdminBusinesses: OWNERS },
  AllFinancialEntities: { allFinancialEntities: { nodes: FINANCIAL_ENTITIES } },
  AllFinancialAccounts: { allFinancialAccounts: FINANCIAL_ACCOUNTS },
  AllTags: { allTags: TAGS },
  AllBusinessTrips: { allBusinessTrips: BUSINESS_TRIPS },
};

function operationName(result: { query: { definitions: readonly unknown[] } }): string {
  const definition = result.query.definitions[0] as { name?: { value?: string } } | undefined;
  return definition?.name?.value ?? '';
}

/** Answers every query from {@link RESPONSES}; unknown operations resolve to null. */
const resolvedExchange: Exchange = () => operations$ =>
  pipe(
    operations$,
    map((operation): OperationResult => ({
      operation,
      data: RESPONSES[operationName(operation)] ?? null,
      error: undefined,
      extensions: undefined,
      hasNext: false,
      stale: false,
    })),
  );

/** Never resolves, so every picker stays in its fetching state. */
const pendingExchange: Exchange = () => () => never;

function mockClient(exchange: Exchange): Client {
  return new Client({ url: '/graphql', exchanges: [exchange] });
}

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

const USER_CONTEXT = {
  userContext: {
    context: { adminBusinessId: 'owner-1' },
  },
  setUserContext: () => void 0,
} as never;

type HarnessProps = {
  initialFilter?: ChargeFilter;
  initiallyOpened?: boolean;
  withDefaultDateRange?: boolean;
  loading?: boolean;
  totalPages?: number;
};

/**
 * In the app the filter is teleported into the footer bar via `FiltersContext`.
 * Here it renders inline, with the applied filter echoed underneath so a story
 * shows what Apply actually produced.
 */
function Harness({
  initialFilter,
  initiallyOpened = true,
  withDefaultDateRange = true,
  loading = false,
  totalPages = 1,
}: HarnessProps): ReactElement {
  const [filter, setFilter] = useState<ChargeFilter>(initialFilter ?? {});
  const [page, setPage] = useState(0);

  return (
    <Provider value={mockClient(loading ? pendingExchange : resolvedExchange)}>
      <UserContext.Provider value={USER_CONTEXT}>
        <MemoryRouter initialEntries={['/charges']}>
          <div className="flex min-h-screen flex-col gap-4 bg-gray-100 p-6">
            <div className="flex h-14 items-center justify-center rounded-lg border bg-white">
              <ChargesFilters
                filter={filter}
                setFilter={setFilter}
                activePage={page}
                setPage={setPage}
                totalPages={totalPages}
                initiallyOpened={initiallyOpened}
                withDefaultDateRange={withDefaultDateRange}
              />
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-white p-3 text-xs">
              {JSON.stringify(filter, null, 2)}
            </pre>
          </div>
        </MemoryRouter>
      </UserContext.Provider>
    </Provider>
  );
}

// Typed against the harness rather than `ChargesFilters` itself: the component
// requires `setFilter`/`activePage`/`setPage`, which the harness owns as state so
// that Apply, Reset and chip removal actually do something in the story.
const meta = {
  title: 'Charges/ChargesFilters',
  component: Harness,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/*  States                                                                     */
/* -------------------------------------------------------------------------- */

/** Opens with the defaults a fresh visit gets: owner seeded, last-year window. */
export const Default: Story = {
  args: {},
};

/**
 * The missing-info screen passes `withDefaultDateRange={false}` so old unresolved
 * charges aren't hidden behind a last-year window — the date fields start empty.
 */
export const WithoutDefaultDateRange: Story = {
  args: { withDefaultDateRange: false },
};

/** Every picker fetching: the trigger shows a spinner and Apply is disabled. */
export const Loading: Story = {
  args: { loading: true },
};

/** A mix across the sections, so each accordion header shows a count pill. */
export const WithActiveFilters: Story = {
  args: {
    initialFilter: {
      byOwners: ['owner-1'],
      byBusinesses: ['entity-0', 'entity-1'],
      byTags: ['tag-1'],
      fromAnyDate: '2026-01-01',
      toAnyDate: '2026-06-30',
      chargesType: ChargeFilterType.Expense,
      withoutInvoice: true,
      withMissingCounterparty: true,
    },
  },
};

/**
 * The tri-state in its excluded form. Excluded values carry the destructive
 * tokens and a leading minus, in both the header chips and the field itself.
 */
export const WithExclusions: Story = {
  args: {
    initialFilter: {
      byBusinesses: ['entity-0'],
      excludedBusinesses: ['entity-1', 'entity-4'],
      excludedTags: ['tag-3'],
      excludedFinancialAccounts: ['acct-3'],
      freeText: 'invoice',
    },
  },
};

/**
 * "Excludes" mode on free text — one field, two form values, so the input is
 * bound to `excludedFreeText` and tinted.
 */
export const ExcludedFreeText: Story = {
  args: { initialFilter: { excludedFreeText: 'refund' } },
};

/**
 * Past the chip cap. The header is `shrink-0` and outside the scrollable body,
 * so the list collapses to 7 chips plus a count rather than squeezing the form
 * — reachable in two clicks via "(Select All)" on financial entities.
 */
export const ManyFiltersOverflow: Story = {
  args: {
    initialFilter: {
      byBusinesses: FINANCIAL_ENTITIES.map(entity => entity.id),
      byTags: TAGS.map(tag => tag.id),
      fromAnyDate: '2026-01-01',
      toAnyDate: '2026-12-31',
      freeText: 'consulting',
    },
  },
};

/** Accounts grouped by type — open the Financial Accounts picker to see headings. */
export const GroupedFinancialAccounts: Story = {
  args: { initialFilter: { byFinancialAccounts: ['acct-1', 'acct-3', 'acct-7'] } },
};

/**
 * Business Trips only appears once BUSINESS_TRIP is among the charge types — or,
 * as here, whenever a trip is already selected, so a deep link can't strand it.
 */
export const BusinessTripsVisible: Story = {
  args: {
    initialFilter: {
      byChargeTypes: [ChargeType.BusinessTrip],
      byBusinessTrips: ['trip-1'],
    },
  },
};

/** Closed, showing the footer-bar affordance: count badge plus pagination. */
export const TriggerWithActiveCount: Story = {
  args: {
    initiallyOpened: false,
    totalPages: 5,
    initialFilter: {
      byBusinesses: ['entity-0', 'entity-1'],
      byTags: ['tag-1'],
      withoutInvoice: true,
    },
  },
};

/** Closed with nothing applied — no badge. */
export const TriggerEmpty: Story = {
  args: { initiallyOpened: false, initialFilter: {} },
};
