import type { ReactElement } from 'react';
import { BusinessTripReportCarRentalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { AddCarRentalExpense } from '../buttons/add-car-rental-expense.js';
import { CarRentalRow } from './car-rental-row.js';
import { CoreExpenseHeader } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportCarRentalFields on BusinessTrip {
    id
    carRentalExpenses {
      id
      date
      ...BusinessTripReportCarRentalRowFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportCarRentalFieldsFragmentDoc>;
  onChange: () => void;
}

export const CarRental = ({ data, onChange }: Props): ReactElement => {
  const { carRentalExpenses, id } = getFragmentData(
    BusinessTripReportCarRentalFieldsFragmentDoc,
    data,
  );

  if (!carRentalExpenses?.length) {
    return <AddCarRentalExpense businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <CoreExpenseHeader />
            <TableHead>Days</TableHead>
            <TableHead>Type</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {carRentalExpenses
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(carRentalExpenses => (
              <CarRentalRow
                data={carRentalExpenses}
                businessTripId={id}
                onChange={onChange}
                key={carRentalExpenses.id}
              />
            ))}
          <TableRow>
            <TableCell colSpan={6}>
              <AddCarRentalExpense businessTripId={id} onAdd={onChange} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
