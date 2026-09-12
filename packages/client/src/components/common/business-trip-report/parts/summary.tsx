import type { ReactElement } from 'react';
import { BusinessTripReportSummaryFieldsFragmentDoc, Currency } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../../helpers/currency.js';
import { Card } from '../../../ui/card.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportSummaryFields on BusinessTrip {
    id
    ... on BusinessTrip @defer {
      summary {
        excessExpenditure {
          formatted
        }
        excessTax
        rows {
          type
          totalForeignCurrency {
            formatted
          }
          totalLocalCurrency {
            formatted
          }
          taxableForeignCurrency {
            formatted
          }
          taxableLocalCurrency {
            formatted
          }
          maxTaxableForeignCurrency {
            formatted
          }
          maxTaxableLocalCurrency {
            formatted
          }
          excessExpenditure {
            formatted
          }
        }
        errors
      }
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportSummaryFieldsFragmentDoc>;
}

function normalizeSnakeCase(raw: string): string {
  return raw.split('_').map(upperFirst).join(' ');
}

function upperFirst(raw: string): string {
  return raw.slice(0, 1).toUpperCase() + raw.slice(1, raw.length).toLowerCase();
}

export const Summary = ({ data }: Props): ReactElement => {
  const { summary } = getFragmentData(BusinessTripReportSummaryFieldsFragmentDoc, data);

  if (!summary) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      {/* Mantine's `Paper shadow="xs" p="md"` carried its own 16px padding; shadcn's Card
          carries none. `List withPadding` indented by theme.spacing.xl (32px). */}
      {summary.errors?.length && (
        <Card className="p-4 shadow-xs">
          <div className="text-red-500">Errors:</div>
          <ul className="list-disc list-inside pl-8 text-sm">
            {summary.errors.map((error, i) => (
              <li key={i} className="text-red-500">
                {error}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead>Expense Type</TableHead>
            <TableHead>Total {currencyCodeToSymbol(Currency.Usd)}</TableHead>
            <TableHead>Total {currencyCodeToSymbol(Currency.Ils)}</TableHead>

            <TableHead>Max Taxable {currencyCodeToSymbol(Currency.Usd)}</TableHead>
            <TableHead>Taxable {currencyCodeToSymbol(Currency.Usd)}</TableHead>
            <TableHead>Taxable {currencyCodeToSymbol(Currency.Ils)}</TableHead>
            <TableHead>Excess Expenditure</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.rows.map(row => (
            <TableRow key={row.type}>
              <TableCell>{normalizeSnakeCase(row.type)}</TableCell>
              <TableCell>{row.totalForeignCurrency?.formatted}</TableCell>
              <TableCell>{row.totalLocalCurrency?.formatted}</TableCell>
              <TableCell>{row.maxTaxableForeignCurrency?.formatted}</TableCell>
              <TableCell>{row.taxableForeignCurrency?.formatted}</TableCell>
              <TableCell>{row.taxableLocalCurrency?.formatted}</TableCell>
              <TableCell>{row.excessExpenditure?.formatted}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Mantine's `Grid`, on its own breakpoints (md 992, lg 1200) rather than Tailwind's,
          so the columns keep the widths they had. Its `justify="flex-end"` does not survive
          as `justify-end`: Mantine's Grid is flexbox, but `grid-cols-12` makes twelve `1fr`
          tracks that consume the full width, leaving `justify-content` no free space to
          distribute — the cells just auto-placed from column 1. Right alignment is explicit
          `col-start` positions instead: 6+10 of 12 at md (spans 4 and 3), 9+11 at lg (2 and 2). */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 col-start-1 min-[992px]:col-span-4 min-[992px]:col-start-6 min-[1200px]:col-span-2 min-[1200px]:col-start-9">
          Excess Expenditure Tax:
          <div className="text-lg">{summary.excessTax ?? '0'}%</div>
        </div>
        <div className="col-span-12 col-start-1 flex flex-col justify-end min-[992px]:col-span-3 min-[992px]:col-start-10 min-[1200px]:col-span-2 min-[1200px]:col-start-11">
          <div className="text-lg">{summary.excessExpenditure?.formatted ?? '0.00'}</div>
        </div>
      </div>
    </div>
  );
};
