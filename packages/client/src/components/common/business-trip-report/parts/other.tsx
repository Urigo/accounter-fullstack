import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportOtherFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddOtherExpense } from '../buttons/add-other-expense.js';
import { CoreExpenseHeader } from './core-expense-row.js';
import { OtherRow } from './other-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportOtherFields on BusinessTrip {
    id
    otherExpenses {
      id
      date
      ...BusinessTripReportOtherRowFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportOtherFieldsFragmentDoc>;
  onChange: () => void;
}

export const Other = ({ data, onChange }: Props): ReactElement => {
  const { otherExpenses, id } = getFragmentData(BusinessTripReportOtherFieldsFragmentDoc, data);

  if (!otherExpenses?.length) {
    return <AddOtherExpense businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreExpenseHeader />
            <th>Description</th>
            <th>Deductible Expense</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {otherExpenses
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(otherExpense => (
              <OtherRow
                data={otherExpense}
                businessTripId={id}
                onChange={onChange}
                key={otherExpense.id}
              />
            ))}
          <tr>
            <td colSpan={6}>
              <AddOtherExpense businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
