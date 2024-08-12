import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddTravelAndSubsistenceExpense } from '../buttons/add-travel-and-subsistence-expense.js';
import { CoreExpenseHeader } from './core-expense-row.js';
import { TravelAndSubsistenceRow } from './travel-and-subsistence-row.jsx';

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
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreExpenseHeader />
            <th>Expense Type</th>
            <th />
          </tr>
        </thead>
        <tbody>
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
          <tr>
            <td colSpan={6}>
              <AddTravelAndSubsistenceExpense businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
