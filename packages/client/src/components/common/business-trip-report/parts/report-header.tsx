import { ReactElement } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Grid, Text } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const BusinessTripReportHeaderFieldsFragmentDoc = graphql(`
  fragment BusinessTripReportHeaderFields on BusinessTrip {
    id
    name
    dates {
      start
      end
    }
    purpose
    destination
  }
`);

interface Props {
  data: FragmentOf<typeof BusinessTripReportHeaderFieldsFragmentDoc>;
}

export const ReportHeader = ({ data }: Props): ReactElement => {
  const { name, dates, purpose, destination } = readFragment(
    BusinessTripReportHeaderFieldsFragmentDoc,
    data,
  );

  return (
    <Grid>
      <Grid.Col span={12}>
        <Text fz="xl">{name}</Text>
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
        <Text fz="lg">{destination}</Text>
      </Grid.Col>
      <Grid.Col xl={4} lg={6} md={12} orderMd={6}>
        Description:
        <Text fz="lg">{purpose}</Text>
      </Grid.Col>
      <Grid.Col xl={2} lg={3} md={6}>
        Total Days:
        <Text fz="lg">{dates ? differenceInDays(dates.end, dates.start) : 'Missing'}</Text>
      </Grid.Col>
    </Grid>
  );
};
