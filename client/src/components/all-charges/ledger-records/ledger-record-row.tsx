import { ReactElement } from 'react';
import { Badge } from '@mantine/core';
import { TableLedgerRecordsRowFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AccountDetails, GeneralDate } from './cells/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableLedgerRecordsRowFields on LedgerRecord {
    id
    ...LedgerRecordsAccountDetailsFields
    ...LedgerRecordsGeneralDateFields
    description
    reference1
  }
`;

type Props = {
  ledgerRecordProps: FragmentType<typeof TableLedgerRecordsRowFieldsFragmentDoc>;
  matchingStatus?: 'New' | 'Diff' | 'Deleted';
  diffs?: FragmentType<typeof TableLedgerRecordsRowFieldsFragmentDoc>;
};

export const LedgerRecordRow = ({
  ledgerRecordProps,
  diffs,
  matchingStatus,
}: Props): ReactElement => {
  const record = getFragmentData(TableLedgerRecordsRowFieldsFragmentDoc, ledgerRecordProps);
  const diffsRecord = getFragmentData(TableLedgerRecordsRowFieldsFragmentDoc, diffs);

  if (matchingStatus === 'Diff' && !diffsRecord) {
    matchingStatus = 'Deleted';
  }

  return (
    <tr key={record.id}>
      <GeneralDate data={record} diff={diffsRecord} type={1} />
      <GeneralDate data={record} diff={diffsRecord} type={2} />
      <AccountDetails data={record} diff={diffsRecord} cred={false} first />
      <AccountDetails data={record} diff={diffsRecord} cred first />
      <AccountDetails data={record} diff={diffsRecord} cred={false} first={false} />
      <AccountDetails data={record} diff={diffsRecord} cred first={false} />
      <td>
        <div className="flex flex-col">
          {record.description}
          {diffsRecord?.description && diffsRecord?.description !== record.description && (
            <div className="border-2 border-red-500 rounded-md">{diffsRecord?.description}</div>
          )}
        </div>
      </td>
      <td>
        <div className="flex flex-col">
          {record.reference1}
          {diffsRecord?.reference1 && diffsRecord?.reference1 !== record.reference1 && (
            <div className="border-2 border-red-500 rounded-md">{diffsRecord?.reference1}</div>
          )}
        </div>
      </td>
      <td>
        {!!matchingStatus && (
          <Badge variant="filled" color={matchingStatus === 'Deleted' ? 'red' : 'green'}>
            {matchingStatus}
          </Badge>
        )}
      </td>
    </tr>
  );
};
