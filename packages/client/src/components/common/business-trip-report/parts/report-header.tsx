import { ReactElement } from 'react';
import { differenceInDays, format, setHours } from 'date-fns';
import { Grid, Text } from '@mantine/core';
import { BusinessTripReportHeaderFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { CopyToClipboardButton } from '../../index.js';
import { AccountantApproval } from '../buttons/accountant-approval.js';
import { BusinessTripToggleMenu } from './business-trip-toggle-menu.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportHeaderFields on BusinessTrip {
    id
    name
    dates {
      start
      end
    }
    purpose
    destination {
      id
      name
    }
    ...BusinessTripAccountantApprovalFields
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportHeaderFieldsFragmentDoc>;
  onChange: () => void;
}

export const ReportHeader = ({ data, onChange }: Props): ReactElement => {
  const businessTrip = getFragmentData(BusinessTripReportHeaderFieldsFragmentDoc, data);

  const { name, dates, purpose, destination } = businessTrip;

  return (
    <Grid>
      <Grid.Col span={12} className="flex flex-row justify-between items-center">
        <Text fz="xl">{name}</Text>
        <div className="flex flex-row gap-2">
          <AccountantApproval data={businessTrip} onChange={onChange} />
          <CopyToClipboardButton
            isLink
            content={`${window.location.origin}/business-trips/${businessTrip.id}`}
          />
          <BusinessTripToggleMenu businessTripId={businessTrip.id} />
        </div>
      </Grid.Col>
      <Grid.Col xl={2} lg={3} md={6}>
        From Date:
        <Text fz="lg">{dates?.start ? format(new Date(dates.start), 'dd/MM/yy') : 'Missing'}</Text>
      </Grid.Col>
      <Grid.Col xl={2} lg={3} md={6}>
        To Date:
        <Text fz="lg">{dates?.end ? format(new Date(dates.end), 'dd/MM/yy') : 'Missing'}</Text>
      </Grid.Col>
      <Grid.Col xl={2} lg={3} md={6}>
        Destination:
        <Text fz="lg">{destination?.name}</Text>
      </Grid.Col>
      <Grid.Col xl={4} lg={6} md={12} orderMd={6}>
        Description:
        <Text fz="lg">{purpose}</Text>
      </Grid.Col>
      <Grid.Col xl={2} lg={3} md={6}>
        Total Days:
        <Text fz="lg">{dates ? getDaysDiff(dates.start, dates.end) : 'Missing'}</Text>
      </Grid.Col>
    </Grid>
  );
};

function getDaysDiff(start: string, end: string): number {
  return differenceInDays(setHours(new Date(end), 22), setHours(new Date(start), 6)) + 1;
}
