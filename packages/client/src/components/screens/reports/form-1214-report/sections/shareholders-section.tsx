import type { ReactElement } from 'react';
import { Form1214ShareholdersSectionFragmentDoc } from '../../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table.js';
import { Empty, formatPercent, Section } from './section-layout.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment Form1214ShareholdersSection on Report1214 {
    id
    shareholders {
      id
      idNumber
      fullName
      isControllingShareholder
      dividendRightsPercent
      votingRightsPercent
    }
  }
`;

type Props = {
  data: FragmentType<typeof Form1214ShareholdersSectionFragmentDoc>;
};

/** The shareholders of the year (records 1020). */
export function Form1214ShareholdersSection({ data }: Props): ReactElement {
  const { shareholders } = getFragmentData(Form1214ShareholdersSectionFragmentDoc, data);
  const dividendTotal = shareholders.reduce(
    (total, shareholder) => total + (shareholder.dividendRightsPercent ?? 0),
    0,
  );
  return (
    <Section id="shareholders" title="Shareholders">
      {shareholders.length === 0 ? (
        <Empty>No shareholders are saved for this year.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Controlling</TableHead>
              <TableHead className="text-right">Dividend rights %</TableHead>
              <TableHead className="text-right">Voting rights %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shareholders.map(shareholder => (
              <TableRow key={shareholder.id}>
                <TableCell dir="auto">{shareholder.fullName}</TableCell>
                <TableCell className="font-mono">{shareholder.idNumber}</TableCell>
                <TableCell>{shareholder.isControllingShareholder ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  {formatPercent(shareholder.dividendRightsPercent)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(shareholder.votingRightsPercent)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatPercent(dividendTotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
