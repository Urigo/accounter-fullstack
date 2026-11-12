import type { ReactElement } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from 'recharts';
import type { PriceIndexCalculatorSeriesQuery } from '../../../gql/graphql.js';
import { formatStringifyAmount } from '../../../helpers/index.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../ui/chart.js';
import { formatPeriod, formatSignedPercent } from './helpers.js';

type SeriesValue = PriceIndexCalculatorSeriesQuery['priceIndexValues'][number];

const chartConfig = {
  valueInLatestBase: {
    label: 'CPI',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

type Endpoint = { label: string; period: string; valueInLatestBase: number };

type Props = {
  values?: readonly SeriesValue[];
  endpoints: [Endpoint, Endpoint];
  fetching: boolean;
};

export function IndexTrendChart({ values, endpoints, fetching }: Props): ReactElement | null {
  const latestBase = values?.at(-1)?.latestBase;
  // A single month is not a trend
  if (!fetching && (!values || values.length < 2)) {
    return null;
  }

  const [first, last] = [values?.[0], values?.at(-1)];

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPI trend</CardTitle>
        <CardDescription>
          {first && last && latestBase
            ? `Monthly index, ${formatPeriod(first.period)} – ${formatPeriod(last.period)}, in base ${latestBase}`
            : 'Monthly index'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fetching || !values ? (
          <AccounterBarSpinner className="mx-auto my-12" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <LineChart
              accessibilityLayer
              data={[...values]}
              margin={{ top: 24, right: 16, left: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={period => formatPeriod(String(period), "MMM ''yy")}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={value => formatStringifyAmount(Number(value), 0)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const period = (payload?.[0]?.payload as SeriesValue | undefined)?.period;
                      return period ? formatPeriod(period) : '';
                    }}
                    formatter={(value, _name, item) => {
                      const row = item.payload as SeriesValue;
                      return (
                        <div className="flex w-full flex-col gap-0.5">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Index</span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatStringifyAmount(Number(value), 2)}
                            </span>
                          </div>
                          {row.monthlyChangePercent != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Monthly</span>
                              <span className="font-mono tabular-nums">
                                {formatSignedPercent(row.monthlyChangePercent, 1)}
                              </span>
                            </div>
                          )}
                          {row.yearlyChangePercent != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Yearly</span>
                              <span className="font-mono tabular-nums">
                                {formatSignedPercent(row.yearlyChangePercent, 1)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Line
                dataKey="valueInLatestBase"
                type="monotone"
                stroke="var(--color-valueInLatestBase)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {endpoints.map(endpoint => (
                <ReferenceDot
                  key={endpoint.label}
                  x={endpoint.period}
                  y={endpoint.valueInLatestBase}
                  r={5}
                  fill="var(--color-valueInLatestBase)"
                  stroke="var(--color-background)"
                  strokeWidth={2}
                  label={{
                    value: endpoint.label,
                    position: 'top',
                    offset: 10,
                    className: 'fill-foreground text-xs font-medium',
                  }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
