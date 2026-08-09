import { useState, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FiltersContext } from '../../../providers/filters-context.js';
import { AllCharges } from './all-charges.js';

// The screen pauses its charges query until a filter exists, so seed the URL
// with an empty filter object to make it fetch on mount.
const initialEntry = `/charges?chargesFilters=${encodeURIComponent(JSON.stringify({}))}`;

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
  },
  decorators: [
    Story => (
      <MantineProvider theme={{ fontFamily: 'Roboto, sans-serif', fontSizes: { md: '14' } }}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Story />
        </MemoryRouter>
      </MantineProvider>
    ),
  ],
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
