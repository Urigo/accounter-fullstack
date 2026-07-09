import { useState, type ReactElement } from 'react';
import { Table } from '@mantine/core';
import {
  ReportSubCommentaryTableFieldsFragmentDoc,
  type ReportSubCommentaryTableFieldsFragment,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { ToggleExpansionButton } from '../../common/index.js';
import { LedgerTable } from '../../ledger-table/index.js';

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
      <tr>
        <td>{record.financialEntity.name}</td>
        <td>{record.amount.formatted}</td>
        <td>
          {record.ledgerRecords.length > 0 && (
            <ToggleExpansionButton toggleExpansion={setOpened} isExpanded={opened} />
          )}
        </td>
      </tr>
      {opened && (
        <tr>
          <td colSpan={99}>
            <div className="ml-8">
              <LedgerTable ledgerRecordsData={record.ledgerRecords} />
            </div>
          </td>
        </tr>
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
        <tr>
          <td colSpan={99}>
            <Table striped highlightOnHover className="ml-8 w-full h-full">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records
                  ?.sort((a, b) => a.financialEntity.name.localeCompare(b.financialEntity.name))
                  .map(record => (
                    <SubCommentaryEntityRow key={record.financialEntity.id} record={record} />
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
