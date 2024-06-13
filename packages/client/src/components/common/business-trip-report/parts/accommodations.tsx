import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { graphql } from '../../../../graphql.js';
import { AddAccommodationTransaction } from '../buttons/add-accommodation-transaction.jsx';
import { AccommodationsRow } from './accommodations-row.js';
import { CoreTransactionHeader } from './core-transaction-row.js';

export const BusinessTripReportAccommodationsFieldsFragmentDoc = graphql(`
  fragment BusinessTripReportAccommodationsFields on BusinessTrip {
    id
    accommodationTransactions {
      id
      date
      ...BusinessTripReportAccommodationsRowFields
    }
  }
`);

interface Props {
  data: FragmentOf<typeof BusinessTripReportAccommodationsFieldsFragmentDoc>;
  onChange: () => void;
}

export const Accommodations = ({ data, onChange }: Props): ReactElement => {
  const { accommodationTransactions, id } = readFragment(
    BusinessTripReportAccommodationsFieldsFragmentDoc,
    data,
  );

  if (!accommodationTransactions?.length) {
    return <AddAccommodationTransaction businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <CoreTransactionHeader />
            <th>Location</th>
            <th>Nights</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {accommodationTransactions
            .sort((a, b) => {
              // sort by start date (if available, newest top) and then by name
              if (a.date && b.date) {
                return a.date < b.date ? 1 : -1;
              }
              if (a.date) return -1;
              if (b.date) return 1;
              return 0;
            })
            .map(accommodationTransaction => (
              <AccommodationsRow
                data={accommodationTransaction}
                businessTripId={id}
                onChange={onChange}
                key={accommodationTransaction.id}
              />
            ))}
          <tr>
            <td colSpan={6}>
              <AddAccommodationTransaction businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
