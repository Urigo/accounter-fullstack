import { ReactElement } from 'react';
import { TableLedgerRecordsFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { EMPTY_UUID } from '../../../helpers/consts.js';
import { LedgerRecordRow } from './ledger-record-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableLedgerRecordsFields on Charge {
    id
    ... on Charge @defer {
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
  }
`;

type Props = {
  ledgerRecordsProps: FragmentType<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerRecordTable = ({ ledgerRecordsProps }: Props): ReactElement => {
  const { ledger: data } = getFragmentData(TableLedgerRecordsFieldsFragmentDoc, ledgerRecordsProps);

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
              !data.validate?.matches || data.validate.matches?.some(id => id === record.id)
                ? undefined
                : 'Diff'
            }
            diffs={data.validate?.differences?.find(diffRecord => diffRecord.id === record.id)}
          />
        ))}
        {data?.validate?.differences
          ?.filter(record => record.id === EMPTY_UUID)
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
