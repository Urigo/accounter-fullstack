import * as React from 'react';
import {
  AllTransactionsEntity,
  transactionColumnName,
} from './getAllTransactions';
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
  ReceiptFile,
  ShareWith,
  TaxCategory,
  Vat,
} from './cells';

type Props = {
  transaction: AllTransactionsEntity;
  columns: transactionColumnName[];
  index: number;
};

const rowStyle = ({
  hover,
  index,
}: {
  hover: boolean;
  index: number;
}): React.CSSProperties => ({
  backgroundColor: hover ? '#f5f5f5' : index % 2 == 0 ? '#CEE0CC' : undefined,
});

export const TransactionRow: React.FC<Props> = ({
  transaction,
  columns,
  index,
}) => {
  const [hover, setHover] = React.useState(false);

  return (
    <>
      <tr
        style={rowStyle({ hover, index })}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        {columns.map((column) => {
          let cell = <>missing impl</>;
          switch (column) {
            case 'Date': {
              cell = <Date transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Amount': {
              cell = <Amount transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Entity': {
              cell = <Entity transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Description': {
              cell = (
                <Description transaction={transaction} style={styles.td} />
              );
              break;
            }
            case 'Category': {
              cell = <Category transaction={transaction} style={styles.td} />;
              break;
            }
            case 'VAT': {
              cell = <Vat transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Account': {
              cell = <Account transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Share with': {
              cell = <ShareWith transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Tax category': {
              cell = (
                <TaxCategory transaction={transaction} style={styles.td} />
              );
              break;
            }
            case 'Bank Description': {
              cell = (
                <BankDescription transaction={transaction} style={styles.td} />
              );
              break;
            }
            case 'Invoice Img': {
              cell = <InvoiceImg transaction={transaction} style={styles.td} />;
              break;
            }
            case 'Invoice Date': {
              cell = (
                <InvoiceDate transaction={transaction} style={styles.td} />
              );
              break;
            }
            case 'Invoice Number': {
              cell = (
                <InvoiceNumber transaction={transaction} style={styles.td} />
              );
              break;
            }
            case 'Invoice File': {
              cell = (
                <InvoiceFile transaction={transaction} style={styles.td} />
              );
              break;
            }
            case 'Receipt File': {
              cell = (
                <ReceiptFile transaction={transaction} style={styles.td} />
              );
              break;
            }
          }
          return <div>{cell}</div>;
        })}
      </tr>
      <tr>
        <td style={styles.td} colSpan={columns.length}>
          here will be the sub-transaction thingy
        </td>
      </tr>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  td: {
    border: '1px solid black',
    textAlign: 'center',
    fontSize: '14px',
  },
};
