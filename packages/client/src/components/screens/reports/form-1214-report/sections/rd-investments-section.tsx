import type { ReactElement } from 'react';
import { Form1214RdInvestmentsSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
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
  fragment Form1214RdInvestmentsSection on Report1214 {
    id
    profile {
      id
      rdInvestments {
        companyName
        companyFileNumber
        investmentAmount
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214RdInvestmentsSectionFragmentDoc>;
};

/** Investments in R&D companies (records 1030). */
export function Form1214RdInvestmentsSection({ data }: Props): ReactElement {
  const { rdInvestments } = getFragmentData(Form1214RdInvestmentsSectionFragmentDoc, data).profile;
  return (
    <Section id="rd-investments" title="R&D investments">
      {rdInvestments.length === 0 ? (
        <Empty>No R&D investments are saved for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>File number</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rdInvestments.map((investment, index) => (
              <TableRow key={index}>
                <TableCell dir="auto">{investment.companyName}</TableCell>
                <TableCell className="font-mono">{investment.companyFileNumber ?? '-'}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(investment.investmentAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
