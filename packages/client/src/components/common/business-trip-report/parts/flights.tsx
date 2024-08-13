import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportFlightsFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddFlightExpense } from '../buttons/add-flight-expense.js';
import { CoreExpenseHeader } from './core-expense-row.js';
import { FlightsRow } from './flights-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsFields on BusinessTrip {
    id
    flightExpenses {
      id
      date
      ...BusinessTripReportFlightsRowFields
    }
    attendees {
      id
      name
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportFlightsFieldsFragmentDoc>;
  onChange: () => void;
}

export const Flights = ({ data, onChange }: Props): ReactElement => {
  const { flightExpenses, id, attendees } = getFragmentData(
    BusinessTripReportFlightsFieldsFragmentDoc,
    data,
  );

  if (!flightExpenses?.length) {
    return <AddFlightExpense businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreExpenseHeader />
            <th>Flight</th>
            <th>Attendees</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {flightExpenses
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(flightExpense => (
              <FlightsRow
                data={flightExpense}
                businessTripId={id}
                onChange={onChange}
                key={flightExpense.id}
                attendees={attendees}
              />
            ))}
          <tr>
            <td colSpan={5}>
              <AddFlightExpense businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
