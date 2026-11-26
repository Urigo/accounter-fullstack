import type { ReactElement, ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '../../../../ui/card.js';

/** A form 1214 page section; `id` is its stable anchor (`#shareholders`, ...). */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader>
        <h2 className="text-lg leading-none font-semibold">{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function DetailList({ items }: { items: Array<[string, ReactNode]> }): ReactElement {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <dt className="text-muted-foreground">{label}:</dt>
          <dd dir="auto">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });

/** A money amount, or `-` when there is none. */
export function formatNumber(value: number | null | undefined): string {
  return value == null ? '-' : numberFormat.format(value);
}

/** A percent as stored (up to 4 decimals), or `-` when there is none. */
export function formatPercent(value: number | null | undefined): string {
  return value == null ? '-' : percentFormat.format(value);
}
