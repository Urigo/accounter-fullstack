import { ReactElement } from 'react';
import { Badge, Card, Grid, Group, Text } from '@mantine/core';
import { ConversionChargeInfoFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ConversionChargeInfo on ConversionCharge {
    id
    directRate {
      from
      to
      rate
    }
    toLocalRate {
      from
      to
      rate
    }
    cryptoToFiat {
      from
      to
      rate
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof ConversionChargeInfoFragmentDoc>;
};

export const ConversionInfo = ({ chargeProps }: Props): ReactElement => {
  const { directRate, toLocalRate, cryptoToFiat } = getFragmentData(
    ConversionChargeInfoFragmentDoc,
    chargeProps,
  );
  return (
    <Grid justify="space-around">
      {directRate && (
        <Grid.Col span="content">
          <Card shadow="sm" padding="xs" radius="md" withBorder>
            <Group position="apart">
              <Text weight={500}>Direct Conversion Rate</Text>
              <Badge color="green" variant="light">
                {`${Number(directRate.rate)} ${currencyCodeToSymbol(
                  directRate.from,
                )} => ${currencyCodeToSymbol(directRate.to)}`}
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      )}
      {toLocalRate && (
        <Grid.Col span="content">
          <Card shadow="sm" padding="xs" radius="md" withBorder>
            <Group position="apart">
              <Text weight={500}>Local Conversion Rate</Text>
              <Badge color="green" variant="light">
                {`${Number(toLocalRate.rate)} ${currencyCodeToSymbol(
                  toLocalRate.from,
                )} => ${currencyCodeToSymbol(toLocalRate.to)}`}
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      )}
      {cryptoToFiat?.rate && Number(cryptoToFiat.rate) !== 1 && (
        <Grid.Col span="content">
          <Card shadow="sm" padding="xs" radius="md" withBorder>
            <Group position="apart">
              <Text weight={500}>Crypto to Fiat Rate</Text>
              <Badge color="green" variant="light">
                {`${Number(cryptoToFiat.rate)} ${currencyCodeToSymbol(
                  cryptoToFiat.from,
                )} => ${currencyCodeToSymbol(cryptoToFiat.to)}`}
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      )}
    </Grid>
  );
};
