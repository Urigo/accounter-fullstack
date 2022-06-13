import gql from 'graphql-tag';
import { CSSProperties, useState } from 'react';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { ChargesFragment } from '../../../__generated__/types';
import {
  Account,
  Amount,
  BankDescription,
  Category,
  Date,
  Description,
  Entity,
  InvoiceDate,
  InvoiceFile,
  InvoiceImg,
  InvoiceNumber,
  Links,
  ShareWith,
  TaxCategory,
  Vat,
} from './cells';
import { ReceiptDate } from './cells/receipt-date';
import { ReceiptImg } from './cells/receipt-img';
import { ReceiptNumber } from './cells/receipt-number';
import { ReceiptUrl } from './cells/receipt-url';
import { LedgerRecordsTable } from './ledger-records/ledger-records-table';

gql`
  fragment Charges on FinancialEntity {
    charges {
      id
      ...LedgerRecords
    }
  }
`;

type Props = {
  transaction: TransactionType;
  columns: TransactionColumn[];
  index: number;
  charge?: ChargesFragment['charges']['0'];
};

const rowStyle = ({ hover, index }: { hover: boolean; index: number }): CSSProperties => ({
  backgroundColor: hover ? '#f5f5f5' : index % 2 == 0 ? '#CEE0CC' : undefined,
});

export const TransactionRow = ({ transaction, columns, index, charge }: Props) => {
  const [hover, setHover] = useState(false);

  return (
    <>
      <tr style={rowStyle({ hover, index })} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        {columns.map(column => {
          switch (column) {
            case 'Date': {
              return <Date transaction={transaction} />;
            }
            case 'Amount': {
              return <Amount transaction={transaction} />;
            }
            case 'Entity': {
              return <Entity transaction={transaction} />;
            }
            case 'Description': {
              return <Description transaction={transaction} />;
            }
            case 'Category': {
              return <Category transaction={transaction} />;
            }
            case 'VAT': {
              return <Vat transaction={transaction} />;
            }
            case 'Account': {
              return <Account transaction={transaction} />;
            }
            case 'Share with': {
              return <ShareWith transaction={transaction} />;
            }
            case 'Tax category': {
              return <TaxCategory transaction={transaction} />;
            }
            case 'Bank Description': {
              return <BankDescription transaction={transaction} />;
            }
            case 'Invoice Img': {
              return <InvoiceImg transaction={transaction} />;
            }
            case 'Invoice Date': {
              return <InvoiceDate transaction={transaction} />;
            }
            case 'Invoice Number': {
              return <InvoiceNumber transaction={transaction} />;
            }
            case 'Invoice File': {
              return <InvoiceFile transaction={transaction} />;
            }
            case 'Receipt Image': {
              return <ReceiptImg transaction={transaction} />;
            }
            case 'Receipt Date': {
              return <ReceiptDate transaction={transaction} />;
            }
            case 'Receipt Number': {
              return <ReceiptNumber transaction={transaction} />;
            }
            case 'Receipt URL': {
              return <ReceiptUrl transaction={transaction} />;
            }
            case 'Links': {
              return <Links transaction={transaction} />;
            }
          }
          return <td>missing impl</td>;
        })}
      </tr>
      <tr>
        <td colSpan={columns.length}>
          {!charge && <p>No Data</p>}
          {charge && (!charge.ledgerRecords || charge.ledgerRecords.length === 0) && (
            <p>No ledger records for this charge</p>
          )}
          {charge?.ledgerRecords && charge.ledgerRecords.length > 0 && (
            <LedgerRecordsTable ledgerRecords={charge.ledgerRecords} />
          )}
        </td>
      </tr>
    </>
  );
};
