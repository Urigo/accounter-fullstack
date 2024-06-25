import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import {
  BusinessTripReportHeaderFieldsFragmentDoc,
  BusinessTripReportSummaryFieldsFragmentDoc,
  ReportHeader,
  Summary,
} from './parts/index.js';

export const BusinessTripReportFieldsFragmentDoc = graphql(
  `
    fragment BusinessTripReportFields on BusinessTrip {
      id
      ...BusinessTripReportHeaderFields
      ...BusinessTripReportSummaryFields
    }
  `,
  [BusinessTripReportHeaderFieldsFragmentDoc, BusinessTripReportSummaryFieldsFragmentDoc],
);

export function isBusinessTripReportFieldsFragmentReady(
  data?: object | FragmentOf<typeof BusinessTripReportFieldsFragmentDoc>,
): data is FragmentOf<typeof BusinessTripReportFieldsFragmentDoc> {
  if (!!data && 'id' in data) {
    return true;
  }
  return false;
}

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
