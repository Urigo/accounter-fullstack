import type { ReactElement } from 'react';
import { ConversionChargeInfoFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../helpers/index.js';
import { Badge } from '../../ui/badge.js';
import { Card } from '../../ui/card.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ConversionChargeInfo on Charge {
    id
    __typename
    ... on ConversionCharge {
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
  const charge = getFragmentData(ConversionChargeInfoFragmentDoc, chargeProps);
  if (charge.__typename !== 'ConversionCharge') {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  const { eventRate, officialRate } = charge;
  return (
    // Mantine's `Grid justify="center"` with `Grid.Col span="content"`: content-width
    // columns, centred. That is a centred flex row, not a 12-column grid.
    <div className="flex flex-wrap justify-center gap-4">
      {officialRate && (
        <Card className="p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">Official Conversion Rate</div>
            {/* Mantine's `variant="light"` badge was a tinted fill with matching text. */}
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {`${Number(officialRate.rate)} ${currencyCodeToSymbol(
                officialRate.from,
              )} => ${currencyCodeToSymbol(officialRate.to)}`}
            </Badge>
          </div>
        </Card>
      )}
      {eventRate && (
        <Card className="p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">Bank Conversion Rate</div>
            {/* Mantine's `variant="light"` badge was a tinted fill with matching text. */}
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {`${Number(eventRate.rate)} ${currencyCodeToSymbol(
                eventRate.from,
              )} => ${currencyCodeToSymbol(eventRate.to)}`}
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
};
