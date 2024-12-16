import { ReactElement } from 'react';
import { BusinessTripReportFlightsFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { FlightsTable } from './flights-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsFields on BusinessTrip {
    id
    flightExpenses {
      id
      ...BusinessTripReportFlightsTableFields
    }
    attendees {
      id
      name
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportFlightsFieldsFragmentDoc>;
  onChange: () => void;
}

export const Flights = ({ data, onChange }: Props): ReactElement => {
  const { flightExpenses, id, attendees } = getFragmentData(
    BusinessTripReportFlightsFieldsFragmentDoc,
    data,
  );
  return (
    <FlightsTable
      businessTripId={id}
      attendees={attendees}
      expenses={flightExpenses}
      onChange={onChange}
    />
  );
};
