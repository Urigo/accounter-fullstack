import { ReactElement } from 'react';
import { BusinessTripReportFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { ReportHeader } from './parts/report-header.js';
import { Summary } from './parts/summary.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFields on BusinessTrip {
    id
    ...BusinessTripReportHeaderFields
    ...BusinessTripReportSummaryFields
  }
`;

type Props = {
  data: FragmentType<typeof BusinessTripReportFieldsFragmentDoc>;
};

export const BusinessTripSummarizedReport = ({ data }: Props): ReactElement => {
  const reportData = getFragmentData(BusinessTripReportFieldsFragmentDoc, data);

  return (
    <>
      <ReportHeader data={reportData} />
      <Summary data={reportData} />
    </>
  );
};
