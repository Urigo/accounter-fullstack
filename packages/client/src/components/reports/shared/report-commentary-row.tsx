import { useState, type ReactElement } from 'react';
import { ReportCommentaryTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { ToggleExpansionButton } from '../../common/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table.js';
import { ReportSubCommentaryRow } from './report-sub-commentary-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ReportCommentaryTableFields on ReportCommentary {
    records {
      sortCode {
        id
        key
        name
      }
      amount {
        formatted
      }
      records {
        ...ReportSubCommentaryTableFields
      }
    }
  }
`;

type Props = {
  dataRow: (extendButton: ReactElement | null) => ReactElement;
  commentaryData: FragmentType<typeof ReportCommentaryTableFieldsFragmentDoc>;
};

export const ReportCommentaryRow = ({ commentaryData, dataRow }: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const { records } = getFragmentData(ReportCommentaryTableFieldsFragmentDoc, commentaryData);

  const button = records.length ? (
    <ToggleExpansionButton toggleExpansion={setOpened} isExpanded={opened} />
  ) : null;

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
                  <TableHead>Sort Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records
                  ?.sort((a, b) => a.sortCode.key - b.sortCode.key)
                  .map(record => (
                    <ReportSubCommentaryRow
                      key={record.sortCode.key}
                      dataRow={button => (
                        <TableRow key={record.sortCode.key}>
                          <TableCell>
                            {record.sortCode.key} - {record.sortCode.name}
                          </TableCell>
                          <TableCell>{record.amount.formatted}</TableCell>
                          <TableCell>{button}</TableCell>
                        </TableRow>
                      )}
                      subCommentaryData={record.records}
                    />
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
