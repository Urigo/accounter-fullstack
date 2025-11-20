import { DollarSign, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart.js';

const revenueData = [
  { month: 'Jan', revenue: 12_500, expenses: 8200 },
  { month: 'Feb', revenue: 15_800, expenses: 9100 },
  { month: 'Mar', revenue: 18_200, expenses: 10_500 },
  { month: 'Apr', revenue: 16_900, expenses: 9800 },
  { month: 'May', revenue: 21_300, expenses: 11_200 },
  { month: 'Jun', revenue: 24_500, expenses: 12_800 },
  { month: 'Jul', revenue: 22_800, expenses: 11_900 },
  { month: 'Aug', revenue: 26_100, expenses: 13_500 },
  { month: 'Sep', revenue: 28_900, expenses: 14_200 },
  { month: 'Oct', revenue: 31_200, expenses: 15_100 },
];

export function ChartsSection() {
  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const avgRevenue = totalRevenue / revenueData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Analytics</CardTitle>
        <CardDescription>Revenue and expenses over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </div>
            <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+24.5% from last period</span>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Average Monthly
            </div>
            <p className="text-2xl font-bold">
              ${avgRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+18.2% growth rate</span>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Current Month
            </div>
            <p className="text-2xl font-bold">
              ${revenueData[revenueData.length - 1].revenue.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+8.0% from last month</span>
            </div>
          </div>
        </div>

        <ChartContainer
          config={{
            revenue: {
              label: 'Revenue',
              color: 'hsl(var(--chart-1))',
            },
            expenses: {
              label: 'Expenses',
              color: 'hsl(var(--chart-2))',
            },
          }}
          className="h-[400px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-revenue)', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="var(--color-expenses)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-expenses)', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
