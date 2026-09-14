import type { ReactElement } from 'react';
import { BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { AddTravelAndSubsistenceExpense } from '../buttons/add-travel-and-subsistence-expense.js';
import { CoreExpenseHeader } from './core-expense-row.js';
import { TravelAndSubsistenceRow } from './travel-and-subsistence-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportTravelAndSubsistenceFields on BusinessTrip {
    id
    travelAndSubsistenceExpenses {
      id
      date
      ...BusinessTripReportTravelAndSubsistenceRowFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc>;
  onChange: () => void;
}

export const TravelAndSubsistence = ({ data, onChange }: Props): ReactElement => {
  const { travelAndSubsistenceExpenses, id } = getFragmentData(
    BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc,
    data,
  );

  if (!travelAndSubsistenceExpenses?.length) {
    return <AddTravelAndSubsistenceExpense businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <CoreExpenseHeader />
            <TableHead>Expense Type</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {travelAndSubsistenceExpenses
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(travelAndSubsistenceExpense => (
              <TravelAndSubsistenceRow
                data={travelAndSubsistenceExpense}
                businessTripId={id}
                onChange={onChange}
                key={travelAndSubsistenceExpense.id}
              />
            ))}
          <TableRow>
            <TableCell colSpan={6}>
              <AddTravelAndSubsistenceExpense businessTripId={id} onAdd={onChange} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
