/* participants */
// name
// position
// id

import { ReactElement } from 'react';
import { BusinessTripReportFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { Accommodations } from './parts/accommodations.js';
import { Attendees } from './parts/attendees.js';
import { Flights } from './parts/flights.js';
import { Other } from './parts/other.js';
import { ReportHeader } from './parts/report-header';
import { Summary } from './parts/summary.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFields on BusinessTrip {
    id
    ...BusinessTripReportHeaderFields
    ...BusinessTripReportAttendeesFields
    ...BusinessTripReportAccommodationsFields
    ...BusinessTripReportOtherFields
    ...BusinessTripReportSummaryFields
  }
`;

type Props = {
  data: FragmentType<typeof BusinessTripReportFieldsFragmentDoc>;
};

export const BusinessTripReport = ({ data }: Props): ReactElement => {
  const reportData = getFragmentData(BusinessTripReportFieldsFragmentDoc, data);

  return (
    <>
      <ReportHeader data={reportData} />
      <Attendees data={reportData} />
      <Flights data={reportData} />
      <Accommodations data={reportData} />
      {/* <TravelAndSubsistence data={reportData} /> */}
      <Other data={reportData} />
      <Summary data={reportData} />
    </>
  );
};
