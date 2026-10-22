import { useCallback, useMemo, type ReactElement } from 'react';
import { useQuery, type CombinedError } from 'urql';
import {
  PriceIndexCalculatorLinkageDocument,
  PriceIndexCalculatorSeriesDocument,
} from '../../../gql/graphql.js';
import { useUrlFilterState } from '../../../hooks/use-url-filter-state.js';
import { normalizeFilter } from '../../../router/routes.js';
import { PageLayout } from '../../layout/page-layout.js';
import { CalculatorForm } from './calculator-form.js';
import {
  calculatorInputSchema,
  CPI_CALCULATOR_PARAM,
  defaultCalculatorInput,
  periodRange,
  type CalculatorInput,
} from './helpers.js';
import { IndexTrendChart } from './index-trend-chart.js';
import { LinkageResult } from './linkage-result.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query PriceIndexCalculatorLinkage(
    $amount: Float!
    $from: PriceIndexPointInput!
    $to: PriceIndexPointInput!
  ) {
    priceIndexLinkage(type: CONSUMER_PRICE_INDEX, amount: $amount, from: $from, to: $to) {
      amount
      linkedAmount
      linkageDifference
      ratio
      changePercent
      fromIndex {
        period
        value
        base
        valueInLatestBase
        latestBase
        publishedOn
      }
      toIndex {
        period
        value
        base
        valueInLatestBase
        latestBase
        publishedOn
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query PriceIndexCalculatorSeries($fromPeriod: String!, $toPeriod: String!) {
    priceIndexValues(type: CONSUMER_PRICE_INDEX, fromPeriod: $fromPeriod, toPeriod: $toPeriod) {
      period
      valueInLatestBase
      latestBase
      monthlyChangePercent
      yearlyChangePercent
    }
  }
`;

/** The server's own message (e.g. an index not published yet), without urql's `[GraphQL]` prefix */
function errorMessageOf(error?: CombinedError): string | undefined {
  if (!error) {
    return undefined;
  }
  return error.graphQLErrors[0]?.message ?? error.message;
}

export const PriceIndexCalculator = (): ReactElement => {
  const [filter, setFilter] = useUrlFilterState<CalculatorInput>(
    CPI_CALCULATOR_PARAM,
    calculatorInputSchema,
  );
  // The URL holds either a whole valid calculation or none (see `decodeFilters`)
  const input = useMemo<CalculatorInput>(
    () => ({ ...defaultCalculatorInput(), ...filter }),
    [filter],
  );

  const [{ data, fetching, error }] = useQuery({
    query: PriceIndexCalculatorLinkageDocument,
    variables: {
      amount: input.amount,
      from: { date: input.fromDate, mode: input.fromMode },
      to: { date: input.toDate, mode: input.toMode },
    },
  });
  const linkage = error ? undefined : data?.priceIndexLinkage;

  const [fromPeriod, toPeriod] = linkage
    ? periodRange(linkage.fromIndex.period, linkage.toIndex.period)
    : ['', ''];
  const [{ data: seriesData, fetching: seriesFetching }] = useQuery({
    query: PriceIndexCalculatorSeriesDocument,
    variables: { fromPeriod, toPeriod },
    pause: !linkage,
  });

  const onSubmit = useCallback(
    (values: CalculatorInput) => setFilter(normalizeFilter(values)),
    [setFilter],
  );

  return (
    <PageLayout
      title="CPI Linkage Calculator"
      description="Link an amount to the Israeli consumer price index between two dates"
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <CalculatorForm
          className="lg:col-span-2"
          value={input}
          onSubmit={onSubmit}
          fetching={fetching}
        />
        <LinkageResult
          className="lg:col-span-3"
          linkage={linkage}
          input={input}
          fetching={fetching}
          errorMessage={errorMessageOf(error)}
        />
      </div>
      {linkage && (
        <IndexTrendChart
          values={seriesData?.priceIndexValues}
          fetching={seriesFetching}
          endpoints={[
            {
              label: 'From',
              period: linkage.fromIndex.period,
              valueInLatestBase: linkage.fromIndex.valueInLatestBase,
            },
            {
              label: 'To',
              period: linkage.toIndex.period,
              valueInLatestBase: linkage.toIndex.valueInLatestBase,
            },
          ]}
        />
      )}
    </PageLayout>
  );
};
