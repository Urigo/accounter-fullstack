import { ReactElement } from 'react';
import { Badge, Card, Grid, Group, Text } from '@mantine/core';
import { ConversionChargeInfoFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ConversionChargeInfo on ConversionCharge {
    id
    ... on ConversionCharge @defer {
      eventRate {
        from
        to
        rate
      }
      officialRate {
        from
        to
        rate
      }
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof ConversionChargeInfoFragmentDoc>;
};

export const ConversionInfo = ({ chargeProps }: Props): ReactElement => {
  const { eventRate, officialRate } = getFragmentData(ConversionChargeInfoFragmentDoc, chargeProps);
  return (
    <Grid justify="center">
      {officialRate && (
        <Grid.Col span="content">
          <Card shadow="sm" padding="xs" radius="md" withBorder>
            <Group position="apart">
              <Text weight={500}>Official Conversion Rate</Text>
              <Badge color="green" variant="light">
                {`${Number(officialRate.rate)} ${currencyCodeToSymbol(
                  officialRate.from,
                )} => ${currencyCodeToSymbol(officialRate.to)}`}
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      )}
      {eventRate && (
        <Grid.Col span="content">
          <Card shadow="sm" padding="xs" radius="md" withBorder>
            <Group position="apart">
              <Text weight={500}>Bank Conversion Rate</Text>
              <Badge color="green" variant="light">
                {`${Number(eventRate.rate)} ${currencyCodeToSymbol(
                  eventRate.from,
                )} => ${currencyCodeToSymbol(eventRate.to)}`}
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      )}
    </Grid>
  );
};
