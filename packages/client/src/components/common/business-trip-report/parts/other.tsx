import type { ReactElement } from 'react';
import { BusinessTripReportOtherFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
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
      <Table className="border">
        <TableHeader>
          <TableRow>
            <CoreExpenseHeader />
            <TableHead>Description</TableHead>
            <TableHead>Deductible Expense</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
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
          <TableRow>
            <TableCell colSpan={6}>
              <AddOtherExpense businessTripId={id} onAdd={onChange} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
