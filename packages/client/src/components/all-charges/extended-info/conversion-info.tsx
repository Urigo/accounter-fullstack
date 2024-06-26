import { ReactElement } from 'react';
import { Badge, Card, Grid, Group, Text } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { currencyCodeToSymbol } from '../../../helpers/index.js';

export const ConversionChargeInfoFragmentDoc = graphql(`
  fragment ConversionChargeInfo on Charge {
    id
    __typename
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
`);

export function isConversionChargeInfoFragmentReady(
  data?: object | FragmentOf<typeof ConversionChargeInfoFragmentDoc>,
): data is FragmentOf<typeof ConversionChargeInfoFragmentDoc> {
  if (!!data && '__typename' in data && data.__typename === 'ConversionCharge') {
    return true;
  }
  return false;
}

type Props = {
  chargeProps: FragmentOf<typeof ConversionChargeInfoFragmentDoc>;
};

export const ConversionInfo = ({ chargeProps }: Props): ReactElement => {
  const charge = readFragment(ConversionChargeInfoFragmentDoc, chargeProps);
  if (
    charge.__typename !== 'ConversionCharge' ||
    !('eventRate' in charge) ||
    !('officialRate' in charge)
  ) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  const { eventRate, officialRate } = charge;
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
