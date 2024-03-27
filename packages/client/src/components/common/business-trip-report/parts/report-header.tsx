import { ReactElement } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Grid, Text } from '@mantine/core';
import { BusinessTripReportHeaderFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

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
    destination
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportHeaderFieldsFragmentDoc>;
}

export const ReportHeader = ({ data }: Props): ReactElement => {
  const { name, dates, purpose, destination } = getFragmentData(
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
