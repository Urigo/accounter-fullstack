import type { ReactElement, ReactNode } from 'react';
import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { PriceIndexCalculatorLinkageQuery, PriceIndexMode } from '../../../gql/graphql.js';
import {
  formatStringifyAmount,
  formatTimelessDate,
  type TimelessDateString,
} from '../../../helpers/index.js';
import { cn } from '../../../lib/utils.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert.js';
import { Badge } from '../../ui/badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import {
  formatPeriod,
  formatShekels,
  formatSignedPercent,
  PRICE_INDEX_MODE_LABELS,
  type CalculatorInput,
} from './helpers.js';

type Linkage = PriceIndexCalculatorLinkageQuery['priceIndexLinkage'];
type IndexValue = Linkage['fromIndex'];

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold tabular-nums', className)}>{value}</div>
    </div>
  );
}

function IndexPoint({
  title,
  index,
  date,
  mode,
}: {
  title: string;
  index: IndexValue;
  date: TimelessDateString;
  mode: PriceIndexMode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</span>
        <Badge variant="outline">{PRICE_INDEX_MODE_LABELS[mode].label}</Badge>
      </div>
      <div className="text-xl font-semibold">{formatPeriod(index.period)}</div>
      <div className="text-sm tabular-nums">
        <span className="font-medium">{formatStringifyAmount(index.value, 1)}</span>{' '}
        <span className="text-gray-500">points · base {index.base}</span>
      </div>
      {index.base !== index.latestBase && (
        <div className="text-sm tabular-nums text-gray-500">
          {formatStringifyAmount(index.valueInLatestBase, 2)} in base {index.latestBase}
        </div>
      )}
      <div className="text-xs text-gray-500">
        For {formatTimelessDate(date, 'dd/MM/yyyy')} · published{' '}
        {formatTimelessDate(index.publishedOn, 'dd/MM/yyyy')}
      </div>
    </div>
  );
}

type Props = {
  linkage?: Linkage;
  input: CalculatorInput;
  fetching: boolean;
  errorMessage?: string;
  className?: string;
};

export function LinkageResult({
  linkage,
  input,
  fetching,
  errorMessage,
  className,
}: Props): ReactElement {
  let content: ReactElement;
  if (fetching) {
    content = <AccounterBarSpinner className="my-12 self-center" />;
  } else if (errorMessage) {
    content = (
      <Alert variant="destructive">
        <AlertTitle>Cannot link this amount</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  } else if (linkage) {
    const difference = Number(linkage.linkageDifference.toFixed(2));
    const TrendIcon = difference > 0 ? TrendingUp : difference < 0 ? TrendingDown : Minus;
    const trendColor =
      difference > 0
        ? 'text-green-700 dark:text-green-400'
        : difference < 0
          ? 'text-red-700 dark:text-red-400'
          : '';

    content = (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-sm text-gray-500">Linked amount</div>
          <div className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
            {formatShekels(linkage.linkedAmount)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="tabular-nums">{formatShekels(linkage.amount)}</span>
            <span>on {formatTimelessDate(input.fromDate, 'dd/MM/yyyy')}</span>
            <ArrowRight className="size-4" aria-label="to" />
            <span>{formatTimelessDate(input.toDate, 'dd/MM/yyyy')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Linkage difference"
            className={trendColor}
            value={
              <span className="inline-flex items-center gap-1.5">
                <TrendIcon className="size-4" aria-hidden />
                {formatShekels(linkage.linkageDifference, { signed: true })}
              </span>
            }
          />
          <Stat label="Index change" value={formatSignedPercent(linkage.changePercent)} />
          <Stat label="Ratio" value={formatStringifyAmount(linkage.ratio, 4)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <IndexPoint
            title="From index"
            index={linkage.fromIndex}
            date={input.fromDate}
            mode={input.fromMode}
          />
          <IndexPoint
            title="To index"
            index={linkage.toIndex}
            date={input.toDate}
            mode={input.toMode}
          />
        </div>
      </div>
    );
  } else {
    content = (
      <p className="my-12 text-center text-sm text-gray-500">
        Enter an amount and two dates, then calculate.
      </p>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Result</CardTitle>
        <CardDescription>Values are rounded for display only</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">{content}</CardContent>
    </Card>
  );
}
