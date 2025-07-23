import { ReactElement, useMemo } from 'react';
import { Currency, ExchangeRatesInfoFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../helpers/index.js';
import { Badge } from '../../ui/badge.js';
import { Card, CardContent, CardTitle } from '../../ui/card.js';

// import { currencyCodeToSymbol } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ExchangeRatesInfo on Charge {
    id
    __typename
    ... on FinancialCharge {
      exchangeRates {
        aud
        cad
        eur
        gbp
        ils
        jpy
        sek
        usd
        eth
        grt
        usdc
      }
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof ExchangeRatesInfoFragmentDoc>;
};

export const ExchangeRates = ({ chargeProps }: Props): ReactElement => {
  const charge = getFragmentData(ExchangeRatesInfoFragmentDoc, chargeProps);
  const exchangeRates = useMemo(() => {
    if (charge.__typename !== 'FinancialCharge') {
      return [];
    }
    return Object.entries(charge.exchangeRates ?? {}).sort((a, b) => a[0].localeCompare(b[0]));
  }, [charge]);

  if (charge.__typename !== 'FinancialCharge') {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  return (
    <div className="flex flex-row flex-wrap gap-2 px-2">
      {exchangeRates.map(([currency, rate]) => (
        <Card key={currency} className="gap-0 py-2">
          <CardContent className="flex flex-col px-2">
            <CardTitle className="text-xl font-semibold">{currency.toLocaleUpperCase()}</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="whitespace-nowrap">
                {currencyCodeToSymbol(currency.toLocaleUpperCase() as Currency)}1=
              </span>
              <Badge variant="default" className="flex gap-1 rounded-lg text-md">
                {currencyCodeToSymbol(Currency.Ils)}
                {rate}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
