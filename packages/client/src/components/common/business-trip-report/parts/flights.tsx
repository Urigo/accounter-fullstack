import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportFlightsFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddFlightTransaction } from '../buttons/add-flight-transaction.js';
import { CoreTransactionHeader } from './core-transaction-row.js';
import { FlightsRow } from './flights-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsFields on BusinessTrip {
    id
    flightTransactions {
      id
      date
      ...BusinessTripReportFlightsRowFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportFlightsFieldsFragmentDoc>;
  onChange: () => void;
}

export const Flights = ({ data, onChange }: Props): ReactElement => {
  const { flightTransactions, id } = getFragmentData(
    BusinessTripReportFlightsFieldsFragmentDoc,
    data,
  );

  if (!flightTransactions?.length) {
    return <AddFlightTransaction businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreTransactionHeader />
            <th>Flight</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {flightTransactions
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(flightTransaction => (
              <FlightsRow
                data={flightTransaction}
                businessTripId={id}
                onChange={onChange}
                key={flightTransaction.id}
              />
            ))}
          <tr>
            <td colSpan={5}>
              <AddFlightTransaction businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
