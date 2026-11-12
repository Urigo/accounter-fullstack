import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChargeSortByField } from '../../../gql/graphql.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { encodeFilters } from '../../../router/routes.js';
import { AllCharges } from './all-charges.js';

// The screen pauses its charges query until a filter is applied, so seed the URL with
// a sort-only filter (what "Clear all" applies) to make it fetch on mount.
const initialEntry = `/charges?${new URLSearchParams({
  chargesFilters: encodeFilters({ sortBy: { field: ChargeSortByField.Date, asc: false } })!,
})}`;

// Minimal stand-in for the dashboard layout: the screen injects its filters bar
// into FiltersContext (the app renders it in the footer); here it renders above
// the table so it stays usable inside Storybook.
function AllChargesHarness(): ReactElement {
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);
  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      <div className="flex flex-col gap-4 p-4">
        {filtersContext}
        <AllCharges />
      </div>
    </FiltersContext.Provider>
  );
}

const meta = {
  title: 'Screens/AllCharges',
  component: AllCharges,
  parameters: {
    layout: 'fullscreen',
    // The router now comes from `.storybook/preview.tsx`.
    router: { initialEntries: [initialEntry] },
  },
} satisfies Meta<typeof AllCharges>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Backed by the auto-mocked GraphQL server — run `yarn mock:server` at the repo
 * root first (or point at a real backend on http://localhost:4000/graphql).
 */
export const Default: Story = {
  render: () => <AllChargesHarness />,
};
