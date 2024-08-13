import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportAccommodationsFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddAccommodationExpense } from '../buttons/add-accommodation-expense.js';
import { AccommodationsRow } from './accommodations-row.js';
import { CoreExpenseHeader } from './core-expense-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAccommodationsFields on BusinessTrip {
    id
    accommodationExpenses {
      id
      date
      ...BusinessTripReportAccommodationsRowFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAccommodationsFieldsFragmentDoc>;
  onChange: () => void;
}

export const Accommodations = ({ data, onChange }: Props): ReactElement => {
  const { accommodationExpenses, id } = getFragmentData(
    BusinessTripReportAccommodationsFieldsFragmentDoc,
    data,
  );

  if (!accommodationExpenses?.length) {
    return <AddAccommodationExpense businessTripId={id} onAdd={onChange} />;
  }

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
                businessTripId={id}
                onChange={onChange}
                key={accommodationExpense.id}
              />
            ))}
          <tr>
            <td colSpan={6}>
              <AddAccommodationExpense businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
