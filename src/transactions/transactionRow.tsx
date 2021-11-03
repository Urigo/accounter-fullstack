import * as React from 'react';
import {
  AllTransactionsEntity,
  transactionColumnName,
} from './getAllTransactions';
import { Account, Amount, BankDescription, Category, Date, Description, Entity, InvoiceDate, InvoiceFile, InvoiceImg, InvoiceNumber, ReceiptFile, ShareWith, TaxCategory, Vat } from './cells';

type Props = {
  transaction: AllTransactionsEntity;
  columns: transactionColumnName[];
};

export const TransactionRow: React.FC<Props> = ({ transaction, columns }) => {
  return (
    <>
      <tr>
        {columns.map((column) => {
          let cell = <>missing impl</>;
          switch (column) {
            case 'Date': {
              cell = <Date transaction={transaction} />;
              break;
            }
            case 'Amount': {
              cell = <Amount transaction={transaction} />;
              break;
            }
            case 'Entity': {
              cell = <Entity transaction={transaction} />;
              break;
            }
            case 'Description': {
              cell = <Description transaction={transaction} />;
              break;
            }
            case 'Category': {
              cell = <Category transaction={transaction} />;
              break;
            }
            case 'VAT': {
              cell = <Vat transaction={transaction} />;
              break;
            }
            case 'Account': {
              cell = <Account transaction={transaction} />;
              break;
            }
            case 'Share with': {
              cell = <ShareWith transaction={transaction} />;
              break;
            }
            case 'Tax category': {
              cell = <TaxCategory transaction={transaction} />;
              break;
            }
            case 'Bank Description': {
              cell = <BankDescription transaction={transaction} />;
              break;
            }
            case 'Invoice Img': {
              cell = <InvoiceImg transaction={transaction} />;
              break;
            }
            case 'Invoice Date': {
              cell = <InvoiceDate transaction={transaction} />;
              break;
            }
            case 'Invoice Number': {
              cell = <InvoiceNumber transaction={transaction} />;
              break;
            }
            case 'Invoice File': {
              cell = <InvoiceFile transaction={transaction} />;
              break;
            }
            case 'Receipt File': {
              cell = <ReceiptFile transaction={transaction} />;
              break;
            }
          }
          return <div>{cell}</div>;
        })}
      </tr>
      <tr>
        <td colSpan={columns.length}>here will be the sub-transaction thingy</td>
      </tr>
    </>
  );
};
