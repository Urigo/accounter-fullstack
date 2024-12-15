import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportAccommodationsTableFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddAccommodationExpense } from '../buttons/add-accommodation-expense.jsx';
import { AccommodationsRow } from './accommodations-row.jsx';
import { CoreExpenseHeader } from './core-expense-row.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAccommodationsTableFields on BusinessTripAccommodationExpense {
    id
    date
    ...BusinessTripReportAccommodationsRowFields
  }
`;

interface Props {
  businessTripId: string;
  expenses: FragmentType<typeof BusinessTripReportAccommodationsTableFieldsFragmentDoc>[];
  onChange?: () => void;
}

export const AccommodationsTable = ({
  businessTripId,
  expenses,
  onChange,
}: Props): ReactElement => {
  if (!expenses?.length) {
    return onChange ? (
      <AddAccommodationExpense businessTripId={businessTripId} onAdd={onChange} />
    ) : (
      // eslint-disable-next-line react/jsx-no-useless-fragment
      <></>
    );
  }

  const accommodationExpenses = expenses.map(expense =>
    getFragmentData(BusinessTripReportAccommodationsTableFieldsFragmentDoc, expense),
  );

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreExpenseHeader />
            <th>Location</th>
            <th>Nights</th>
            <th>Attendees Stay</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {accommodationExpenses
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(accommodationExpense => (
              <AccommodationsRow
                data={accommodationExpense}
                businessTripId={businessTripId}
                onChange={onChange}
                key={accommodationExpense.id}
              />
            ))}
          {onChange && (
            <tr>
              <td colSpan={6}>
                <AddAccommodationExpense businessTripId={businessTripId} onAdd={onChange} />
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};
