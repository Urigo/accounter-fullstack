import { useState, type ReactElement } from 'react';
import { Table } from '@mantine/core';
import { ReportCommentaryTableFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { ToggleExpansionButton } from '../../common/index.js';
import { ReportSubCommentaryRow } from './report-sub-commentary-row.jsx';

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
        <tr>
          <td colSpan={99}>
            <Table striped highlightOnHover className="ml-8 w-full h-full">
              <thead>
                <tr>
                  <th>Sort Code</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records
                  ?.sort((a, b) => a.sortCode.key - b.sortCode.key)
                  .map(record => (
                    <ReportSubCommentaryRow
                      key={record.sortCode.key}
                      dataRow={button => (
                        <tr key={record.sortCode.key}>
                          <td>
                            {record.sortCode.key} - {record.sortCode.name}
                          </td>
                          <td>{record.amount.formatted}</td>
                          <td>{button}</td>
                        </tr>
                      )}
                      subCommentaryData={record.records}
                    />
                  ))}
                <tr>
                  <td colSpan={8} />
                </tr>
              </tbody>
            </Table>
          </td>
        </tr>
      )}
    </>
  );
};
