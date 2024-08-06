import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportOtherFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddOtherTransaction } from '../buttons/add-other-transaction.js';
import { CoreTransactionHeader } from './core-transaction-row.js';
import { OtherRow } from './other-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportOtherFields on BusinessTrip {
    id
    otherTransactions {
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
  const { otherTransactions, id } = getFragmentData(BusinessTripReportOtherFieldsFragmentDoc, data);

  if (!otherTransactions?.length) {
    return <AddOtherTransaction businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreTransactionHeader />
            <th>Description</th>
            <th>Deductible Expense</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {otherTransactions
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(otherTransaction => (
              <OtherRow
                data={otherTransaction}
                businessTripId={id}
                onChange={onChange}
                key={otherTransaction.id}
              />
            ))}
          <tr>
            <td colSpan={6}>
              <AddOtherTransaction businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
