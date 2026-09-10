import { useState, type ReactElement } from 'react';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { map, never, pipe } from 'wonka';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddFlightExpense } from './add-flight-expense.js';

/* -------------------------------------------------------------------------- */
/*  Mock backend                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A local urql client, following `charges-filters.stories.tsx`: these render the same
 * every time without `yarn mock:server` running, and the attendee list has to be known
 * for the pickers to be worth looking at.
 */
const ATTENDEES = [
  { id: 'attendee-1', name: 'Dotan Simha' },
  { id: 'attendee-2', name: 'Uri Goldshtein' },
  { id: 'attendee-3', name: 'Gil Gardosh' },
  { id: 'attendee-4', name: 'Kamil Kisiela' },
];

const RESPONSES: Record<string, unknown> = {
  AttendeesByBusinessTrip: { businessTrip: { id: 'trip-1', attendees: ATTENDEES } },
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

/** Never resolves, so the attendee pickers stay in their fetching state. */
const pendingExchange: Exchange = () => () => never;

function mockClient(exchange: Exchange): Client {
  return new Client({ url: '/graphql', exchanges: [exchange] });
}

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Characterizes the "add expense" dialog shared by the whole `buttons/` directory, which
 * moved off Mantine's `Modal` onto `PopUpModal`. This one is the richest of the eight:
 * a `ComboBox` (was `Select`), a `NegatableMultiSelect` (was `MultiSelect`), the shared
 * `AddExpenseFields`, and a `LoadingOverlay` (was `Overlay` + `Loader`).
 *
 * The trip id is fixed, so `onAdd` only reports that the mutation round-tripped.
 */
function Harness({ loading = false }: { loading?: boolean }): ReactElement {
  const [added, setAdded] = useState(0);
  return (
    <Provider value={mockClient(loading ? pendingExchange : resolvedExchange)}>
      <div className="flex min-h-64 items-start gap-3 bg-gray-100 p-6">
        <AddFlightExpense businessTripId="trip-1" onAdd={() => setAdded(count => count + 1)} />
        <span className="text-xs text-gray-500">added: {added}</span>
      </div>
    </Provider>
  );
}

const meta = {
  title: 'BusinessTripReport/AddFlightExpense',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The trigger on its own; click the plus to open the dialog. */
export const Closed: Story = { args: {} };

/** Attendees never arrive, so the pickers show their loading state behind the overlay. */
export const LoadingAttendees: Story = { args: { loading: true } };
