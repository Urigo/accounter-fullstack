import { useState, type ReactElement } from 'react';
import {
  ReportSubCommentaryTableFieldsFragmentDoc,
  type ReportSubCommentaryTableFieldsFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { ToggleExpansionButton } from '../../common/index.js';
import { LedgerTable } from '../../ledger-table/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ReportSubCommentaryTableFields on ReportCommentarySubRecord {
    financialEntity {
      id
      name
    }
    amount {
      formatted
    }
    ledgerRecords {
      ...LedgerRecordsTableFields
    }
  }
`;

type EntityRowProps = {
  record: ReportSubCommentaryTableFieldsFragment;
};

const SubCommentaryEntityRow = ({ record }: EntityRowProps): ReactElement => {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>{record.financialEntity.name}</TableCell>
        <TableCell>{record.amount.formatted}</TableCell>
        <TableCell>
          {record.ledgerRecords?.length > 0 && (
            <ToggleExpansionButton toggleExpansion={setOpened} isExpanded={opened} />
          )}
        </TableCell>
      </TableRow>
      {opened && record.ledgerRecords && (
        <TableRow>
          <TableCell colSpan={99}>
            <div className="ml-8">
              <LedgerTable ledgerRecordsData={record.ledgerRecords} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

type Props = {
  dataRow: (extendButton: ReactElement) => ReactElement;
  subCommentaryData: FragmentType<typeof ReportSubCommentaryTableFieldsFragmentDoc>[];
};

export const ReportSubCommentaryRow = ({ subCommentaryData, dataRow }: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const records = subCommentaryData.map(record =>
    getFragmentData(ReportSubCommentaryTableFieldsFragmentDoc, record),
  );

  const button = <ToggleExpansionButton toggleExpansion={setOpened} isExpanded={opened} />;

  return (
    <>
      {dataRow(button)}
      {opened && (
        <TableRow>
          <TableCell colSpan={99}>
            {/* Mantine's `striped`, whose selector was `> tbody > tr:nth-of-type(odd)`. The
                child combinators matter: these tables nest, and a descendant selector would
                stripe the inner table's rows from the outer table's rule as well. */}
            <Table className="ml-8 h-full w-full [&>tbody>tr:nth-child(odd)]:bg-gray-50">
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records
                  ?.sort((a, b) => a.financialEntity.name.localeCompare(b.financialEntity.name))
                  .map(record => (
                    <SubCommentaryEntityRow key={record.financialEntity.id} record={record} />
                  ))}
                <TableRow>
                  <TableCell colSpan={8} />
                </TableRow>
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
