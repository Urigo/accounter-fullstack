import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportCarRentalFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddCarRentalExpense } from '../buttons/add-car-rental-expense.jsx';
import { CarRentalRow } from './car-rental-row.jsx';
import { CoreExpenseHeader } from './core-expense-row.jsx';

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
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreExpenseHeader />
            <th>Days</th>
            <th>Type</th>
            <th />
          </tr>
        </thead>
        <tbody>
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
          <tr>
            <td colSpan={6}>
              <AddCarRentalExpense businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
