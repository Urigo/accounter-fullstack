import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { EMPTY_UUID } from '../../../helpers/consts.js';
import { LedgerRecordRow, TableLedgerRecordsRowFieldsFragmentDoc } from './ledger-record-row.js';

export const TableLedgerRecordsFieldsFragmentDoc = graphql(
  `
    fragment TableLedgerRecordsFields on Charge {
      id
      ledger {
        __typename
        records {
          id
          ...TableLedgerRecordsRowFields
        }
        ... on Ledger @defer {
          validate {
            ... on LedgerValidation @defer {
              matches
              differences {
                id
                ...TableLedgerRecordsRowFields
              }
            }
          }
        }
      }
    }
  `,
  [TableLedgerRecordsRowFieldsFragmentDoc],
);

export function isTableLedgerRecordsFieldsFragmentReady(
  data?: object | FragmentOf<typeof TableLedgerRecordsFieldsFragmentDoc>,
): data is FragmentOf<typeof TableLedgerRecordsFieldsFragmentDoc> {
  if (!!data && 'ledger' in data) {
    return true;
  }
  return false;
}

type Props = {
  ledgerRecordsProps: FragmentOf<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerRecordTable = ({ ledgerRecordsProps }: Props): ReactElement => {
  const { ledger: data } = readFragment(TableLedgerRecordsFieldsFragmentDoc, ledgerRecordsProps);

  return (
    <table className="w-full h-full">
      <thead>
        <tr>
          <th>Invoice Date</th>
          <th>Value Date</th>
          <th>Debit Account1</th>
          <th>Credit Account1</th>
          <th>Debit Account2</th>
          <th>Credit Account2</th>
          <th>Details</th>
          <th>Ref1</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {data?.records?.map(record => (
          <LedgerRecordRow
            key={record.id}
            ledgerRecordProps={record}
            matchingStatus={
              !('validate' in data) ||
              !('matches' in data.validate) ||
              data.validate.matches?.some(id => id === record.id)
                ? undefined
                : 'Diff'
            }
            diffs={
              'validate' in data && 'differences' in data.validate
                ? data.validate.differences.find(diffRecord => diffRecord.id === record.id)
                : undefined
            }
          />
        ))}
        {'validate' in data &&
          'differences' in data.validate &&
          data.validate.differences
            .filter(record => record.id === EMPTY_UUID)
            .map(record => (
              <LedgerRecordRow key={record.id} ledgerRecordProps={record} matchingStatus="New" />
            ))}
        <tr>
          <td colSpan={8} />
        </tr>
      </tbody>
    </table>
  );
};
