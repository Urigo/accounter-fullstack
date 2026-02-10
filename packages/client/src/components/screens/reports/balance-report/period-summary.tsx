import type { ReactNode } from 'react';
import { Currency } from '../../../../gql/graphql.js';
import { getCurrencyFormatter } from '../../../../helpers/index.js';
import { Card, CardContent } from '../../../ui/card.js';
import type { PeriodInfo } from './index.js';

type PeriodSummaryProps = {
  periodInfo?: PeriodInfo;
};

export const PeriodSummary = ({ periodInfo }: PeriodSummaryProps): ReactNode => {
  const formatter = getCurrencyFormatter(Currency.Usd);

  if (!periodInfo) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Income */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Income</p>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-1))]" />
              <p className="text-2xl font-bold">{formatter.format(periodInfo.income)}</p>
            </div>
          </div>

          {/* Expense */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Expense</p>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-2))]" />
              <p className="text-2xl font-bold">{formatter.format(periodInfo.expense)}</p>
            </div>
          </div>

          {/* Delta */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Delta</p>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-3))]" />
              <p className="text-2xl font-bold">{formatter.format(periodInfo.delta)}</p>
            </div>
            {/* Delta breakdown by currency */}
            {Object.keys(periodInfo.deltaInfo).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(periodInfo.deltaInfo).map(([currencyCode, amount]) => {
                  const currency = currencyCode as Currency;
                  const currencyFormatter = getCurrencyFormatter(currency);
                  return (
                    <p key={currency} className="text-xs text-muted-foreground">
                      {currencyFormatter.format(amount ?? 0)}
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cumulative */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Cumulative</p>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-4))]" />
              <p className="text-2xl font-bold">{formatter.format(periodInfo.cumulative)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
