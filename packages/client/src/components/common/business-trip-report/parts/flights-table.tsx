import { type ReactElement } from 'react';
import { BusinessTripReportFlightsTableFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { AddFlightExpense } from '../buttons/add-flight-expense.js';
import { CoreExpenseHeader } from './core-expense-row.js';
import { FlightsRow } from './flights-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsTableFields on BusinessTripFlightExpense {
    id
    date
    ...BusinessTripReportFlightsRowFields
  }
`;

interface Props {
  businessTripId: string;
  attendees: { id: string; name: string }[];
  expenses: FragmentType<typeof BusinessTripReportFlightsTableFieldsFragmentDoc>[];
  onChange?: () => void;
}

export const FlightsTable = ({
  businessTripId,
  expenses,
  attendees,
  onChange,
}: Props): ReactElement => {
  if (!expenses?.length) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return onChange ? <AddFlightExpense businessTripId={businessTripId} onAdd={onChange} /> : <></>;
  }

  const flightExpenses = expenses.map(expense =>
    getFragmentData(BusinessTripReportFlightsTableFieldsFragmentDoc, expense),
  );

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <CoreExpenseHeader />
            <TableHead>Flight</TableHead>
            <TableHead>Attendees</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
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
                businessTripId={businessTripId}
                onChange={onChange}
                key={flightExpense.id}
                attendees={attendees}
              />
            ))}
          {onChange && (
            <TableRow>
              <TableCell colSpan={5}>
                <AddFlightExpense businessTripId={businessTripId} onAdd={onChange} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
