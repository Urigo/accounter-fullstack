import { FragmentType, getFragmentData } from '../../../gql';
import { TableLedgerRecordsFieldsFragmentDoc } from '../../../gql/graphql';
import { AccountDetails, GeneralDate } from './cells';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableLedgerRecordsFields on Charge {
    ledgerRecords {
      __typename
      ... on LedgerRecords {
        records {
          id
          ...LedgerRecordsDateFields
          ...LedgerRecordsCreditAccountFields
          ...LedgerRecordsDebitAccountFields
          ...LedgerRecordsAccountDetailsFields
          ...LedgerRecordsGeneralDateFields
          creditAmount1 {
            formatted
          }
          localCurrencyCreditAmount1 {
            formatted
          }
          debitAccount1 {
            id
            name
          }
          description
          reference1
        }
      }
      ... on CommonError {
        message
      }
    }
    # TODO(Gil): Next part is temporary, until we have a new ledger perfected
    oldLedger {
      id
      invoiceDate
      valueDate
      creditAccount1
      creditAccount2
      debitAccount1
      debitAccount2
      debitAmount1
      creditAmount1
      debitAmount2
      creditAmount2
      foreignDebitAmount1
      foreignCreditAmount1
      foreignDebitAmount2
      foreignCreditAmount2
      currency
      details
      reference1
      reference2
    }
  }
`;

type Props = {
  ledgerRecordsProps: FragmentType<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerRecordTable = ({ ledgerRecordsProps }: Props) => {
  const { ledgerRecords: data, oldLedger } = getFragmentData(
    TableLedgerRecordsFieldsFragmentDoc,
    ledgerRecordsProps,
  );

  if (!data || data.__typename === 'CommonError') {
    return <div>{data?.message}</div>;
  }

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
        </tr>
      </thead>
      <tbody>
        {data.records.map(record => (
          <tr key={record.id}>
            <GeneralDate data={record} type={1} />
            <GeneralDate data={record} type={2} />
            <AccountDetails data={record} cred={false} first />
            <AccountDetails data={record} cred first />
            <AccountDetails data={record} cred={false} first={false} />
            <AccountDetails data={record} cred first={false} />
            <td>{record.description}</td>
            <td>{record.reference1}</td>
          </tr>
        ))}
        {/* TODO(Gil): Next part is temporary, until we have a new ledger perfected */}
        <tr>
          <td colSpan={8} />
        </tr>
        {oldLedger.map(record => (
          <tr key={record.id} className="border-4 border-red-500">
            <td>{record.invoiceDate}</td>
            <td>{record.valueDate}</td>
            <td>
              {record.debitAccount1}
              {record.foreignDebitAmount1 && (
                <>
                  <br />
                  {record.foreignDebitAmount1} {record.currency}
                </>
              )}
              <br />
              {record.debitAmount1} ILS
            </td>
            <td>
              {record.creditAccount1}
              {record.foreignCreditAmount1 && (
                <>
                  <br />
                  {record.foreignCreditAmount1} {record.currency}
                </>
              )}
              <br />
              {record.creditAmount1} ILS
            </td>
            <td>
              {record.debitAccount2}
              {record.foreignDebitAmount2 && (
                <>
                  <br />
                  {record.foreignDebitAmount2} {record.currency}
                </>
              )}
              <br />
              {record.debitAmount2} ILS
            </td>
            <td>
              {record.creditAccount2}
              {record.foreignCreditAmount2 && (
                <>
                  <br />
                  {record.foreignCreditAmount2} {record.currency}
                </>
              )}
              <br />
              {record.creditAmount2} ILS
            </td>
            <td>{record.details}</td>
            <td>
              {record.reference1}
              <br />
              {record.reference2}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
