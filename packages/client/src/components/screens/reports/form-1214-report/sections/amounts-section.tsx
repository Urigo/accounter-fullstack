import type { ReactElement } from 'react';
import {
  Form1214AmountsSectionFragmentDoc,
  Report1214AmountSource,
} from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import { Badge } from '../../../../ui/badge.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table.js';
import { Empty, formatNumber, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214AmountsSection on Report1214 {
    id
    amounts {
      code
      amount
      source
      computedAmount
      label
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214AmountsSectionFragmentDoc>;
};

/** The record 1000 amounts of the report: computed by Accounter or entered as overrides. */
export function Form1214AmountsSection({ data }: Props): ReactElement {
  const { amounts } = getFragmentData(Form1214AmountsSectionFragmentDoc, data);
  return (
    <Section id="amounts" title="Amounts (record 1000)">
      {amounts.length === 0 ? (
        <Empty>No amounts are computed or entered for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Computed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {amounts.map(amount => (
              <TableRow key={amount.code}>
                <TableCell className="font-mono">{amount.code}</TableCell>
                <TableCell dir="auto">{amount.label ?? ''}</TableCell>
                <TableCell className="text-right">{formatNumber(amount.amount)}</TableCell>
                <TableCell>
                  {amount.source === Report1214AmountSource.Override ? (
                    <Badge variant="outline">Override</Badge>
                  ) : (
                    <Badge variant="secondary">Computed</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatNumber(amount.computedAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
