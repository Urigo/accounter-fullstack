import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { ReportHeader } from './parts/report-header.js';
import { Summary } from './parts/summary.js';

export const BusinessTripReportFieldsFragmentDoc = graphql(`
  fragment BusinessTripReportFields on BusinessTrip {
    id
    ...BusinessTripReportHeaderFields
    ...BusinessTripReportSummaryFields
  }
`);

type Props = {
  data: FragmentOf<typeof BusinessTripReportFieldsFragmentDoc>;
};

export const BusinessTripSummarizedReport = ({ data }: Props): ReactElement => {
  const reportData = readFragment(BusinessTripReportFieldsFragmentDoc, data);

  return (
    <>
      <ReportHeader data={reportData} />
      <Summary data={reportData} />
    </>
  );
};
