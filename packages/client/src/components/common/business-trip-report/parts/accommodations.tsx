import { ReactElement } from 'react';
import { BusinessTripReportAccommodationsFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AccommodationsTable } from './accommodations-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAccommodationsFields on BusinessTrip {
    id
    accommodationExpenses {
      id
      ...BusinessTripReportAccommodationsTableFields
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

  return (
    <AccommodationsTable businessTripId={id} expenses={accommodationExpenses} onChange={onChange} />
  );
};
