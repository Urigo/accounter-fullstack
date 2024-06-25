import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';
import { AddTravelAndSubsistenceTransaction } from '../buttons/add-travel-and-subsistence-transaction.jsx';
import { CoreTransactionHeader } from './core-transaction-row.js';
import {
  BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc,
  TravelAndSubsistenceRow,
} from './travel-and-subsistence-row.jsx';

export const BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc = graphql(
  `
    fragment BusinessTripReportTravelAndSubsistenceFields on BusinessTrip {
      id
      travelAndSubsistenceTransactions {
        id
        date
        ...BusinessTripReportTravelAndSubsistenceRowFields
      }
    }
  `,
  [BusinessTripReportTravelAndSubsistenceRowFieldsFragmentDoc],
);

interface Props {
  data: FragmentOf<typeof BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc>;
  onChange: () => void;
}

export const TravelAndSubsistence = ({ data, onChange }: Props): ReactElement => {
  const { travelAndSubsistenceTransactions, id } = readFragment(
    BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc,
    data,
  );

  if (!travelAndSubsistenceTransactions?.length) {
    return <AddTravelAndSubsistenceTransaction businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreTransactionHeader />
            <th>Expense Type</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {travelAndSubsistenceTransactions
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(travelAndSubsistenceTransaction => (
              <TravelAndSubsistenceRow
                data={travelAndSubsistenceTransaction}
                businessTripId={id}
                onChange={onChange}
                key={travelAndSubsistenceTransaction.id}
              />
            ))}
          <tr>
            <td colSpan={6}>
              <AddTravelAndSubsistenceTransaction businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
