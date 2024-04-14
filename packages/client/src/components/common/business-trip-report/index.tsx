/* participants */
// name
// position
// id

import { ReactElement } from 'react';
import { BusinessTripReportFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { Attendees } from './parts/attendees.js';
import { ReportHeader } from './parts/report-header';
import { Summary } from './parts/summary.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFields on BusinessTrip {
    id
    ...BusinessTripReportHeaderFields
    ...BusinessTripReportAttendeesFields
    ...BusinessTripReportAccommodationsFields
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
      {/* flights */}
      {/* accommodations */}
      {/* t&s */}
      {/* other */}
      <Summary data={reportData} />
    </>
  );
};
