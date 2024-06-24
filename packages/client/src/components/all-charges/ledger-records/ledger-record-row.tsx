import { ReactElement } from 'react';
import { Badge } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import {
  AccountDetails,
  GeneralDate,
  LedgerRecordsAccountDetailsFieldsFragmentDoc,
  LedgerRecordsGeneralDateFieldsFragmentDoc,
} from './cells/index.js';

export const TableLedgerRecordsRowFieldsFragmentDoc = graphql(
  `
    fragment TableLedgerRecordsRowFields on LedgerRecord {
      id
      ...LedgerRecordsAccountDetailsFields
      ...LedgerRecordsGeneralDateFields
      description
      reference1
    }
  `,
  [LedgerRecordsAccountDetailsFieldsFragmentDoc, LedgerRecordsGeneralDateFieldsFragmentDoc],
);

type Props = {
  ledgerRecordProps: FragmentOf<typeof TableLedgerRecordsRowFieldsFragmentDoc>;
  matchingStatus?: 'New' | 'Diff' | 'Deleted';
  diffs?: FragmentOf<typeof TableLedgerRecordsRowFieldsFragmentDoc>;
};

export const LedgerRecordRow = ({
  ledgerRecordProps,
  diffs,
  matchingStatus,
}: Props): ReactElement => {
  const record = readFragment(TableLedgerRecordsRowFieldsFragmentDoc, ledgerRecordProps);
  const diffsRecord = readFragment(TableLedgerRecordsRowFieldsFragmentDoc, diffs);

  if (matchingStatus === 'Diff' && !diffsRecord) {
    matchingStatus = 'Deleted';
  }

  let rowStyle = '';
  switch (matchingStatus) {
    case 'New':
      rowStyle = 'bg-opacity-30 bg-green-100';
      break;
    case 'Deleted':
      rowStyle = 'bg-opacity-30 bg-red-100';
      break;
    case 'Diff':
      rowStyle = 'bg-opacity-30 bg-yellow-100';
      break;
  }

  return (
    <tr key={record.id} className={rowStyle}>
      <GeneralDate data={record} diff={diffsRecord} type={1} />
      <GeneralDate data={record} diff={diffsRecord} type={2} />
      <AccountDetails data={record} diff={diffsRecord} cred={false} first />
      <AccountDetails data={record} diff={diffsRecord} cred first />
      <AccountDetails data={record} diff={diffsRecord} cred={false} first={false} />
      <AccountDetails data={record} diff={diffsRecord} cred first={false} />
      <td>
        <div className="flex flex-col">
          <p
            className={
              !diffsRecord?.description || diffsRecord.description === record.description
                ? ''
                : 'line-through'
            }
          >
            {record.description}
          </p>
          {diffsRecord?.description && diffsRecord.description !== record.description && (
            <div className="border-2 border-yellow-500 rounded-md">{diffsRecord?.description}</div>
          )}
        </div>
      </td>
      <td>
        <div className="flex flex-col">
          <p
            className={
              !diffsRecord?.reference1 || diffsRecord.reference1 === record.reference1
                ? ''
                : 'line-through'
            }
          >
            {record.reference1}
          </p>
          {diffsRecord?.reference1 && diffsRecord?.reference1 !== record.reference1 && (
            <div className="border-2 border-yellow-500 rounded-md">{diffsRecord?.reference1}</div>
          )}
        </div>
      </td>
      <td>
        {!!matchingStatus && (
          <Badge
            variant="filled"
            color={
              matchingStatus === 'Deleted' ? 'red' : matchingStatus === 'Diff' ? 'yellow' : 'green'
            }
          >
            {matchingStatus}
          </Badge>
        )}
      </td>
    </tr>
  );
};
