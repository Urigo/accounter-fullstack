import gql from 'graphql-tag';
import { CSSProperties, FC, useState } from 'react';
import type { TransactionColumn } from '../../models/types';
import { ChargesFieldsFragment } from '../../__generated__/types';
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
import { ReceiptDate } from './cells/ReceiptDate';
import { ReceiptImg } from './cells/ReceiptImg';
import { ReceiptNumber } from './cells/ReceiptNumber';
import { ReceiptUrl } from './cells/ReceiptUrl';
import { LedgerRecordsTable } from './ledgerRecords/LedgerRecordsTable';

gql`
  fragment ChargesFields on FinancialEntity {
    charges {
      id
      ...dateFields
      ...amountFields
      ...entityFields
      ...descriptionFields
      ...categoryFields
      ...ledgerRecordsFields
    }
  }
`;

type Props = {
  columns: TransactionColumn[];
  index: number;
  charge: ChargesFieldsFragment['charges']['0'];
};

const rowStyle = ({
  hover,
  index,
}: {
  hover: boolean;
  index: number;
}): CSSProperties => ({
  backgroundColor: hover ? '#f5f5f5' : index % 2 == 0 ? '#CEE0CC' : undefined,
});

export const ChargeRow: FC<Props> = ({ columns, index, charge }) => {
  const [hover, setHover] = useState(false);

  return (
    <>
      <tr
        style={rowStyle({ hover, index })}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        {columns.map((column) => {
          switch (column) {
            case 'Date': {
              return (
                <Date
                  createdAt={charge.transactions[0].createdAt}
                  effectiveDate={charge.transactions[0].effectiveDate}
                />
              );
            }
            case 'Amount': {
              return (
                <Amount amount={charge.transactions[0].amount.formatted} />
              );
            }
            case 'Entity': {
              return <Entity name={charge.counterparty.name} />;
            }
            case 'Description': {
              return (
                <Description description={charge.transactions[0].description} />
              );
            }
            case 'Category': {
              return <Category tags={charge.tags} />;
            }
            // case 'VAT': {
            //   return <Vat vat={charge.vat.formatted} />;
            // }
            // case 'Account': {
            //   return <Account charge={charge} />;
            // }
            // case 'Share with': {
            //   return <ShareWith charge={charge} />;
            // }
            // case 'Bank Description': {
            //   return <BankDescription charge={charge} />;
            // }
            // case 'Invoice Img': {
            //   return <InvoiceImg charge={charge} />;
            // }
            // case 'Invoice Date': {
            //   return <InvoiceDate charge={charge} />;
            // }
            // case 'Invoice Number': {
            //   return <InvoiceNumber charge={charge} />;
            // }
            // case 'Invoice File': {
            //   return <InvoiceFile charge={charge} />;
            // }
            // case 'Receipt Image': {
            //   return <ReceiptImg charge={charge} />;
            // }
            // case 'Receipt Date': {
            //   return <ReceiptDate charge={charge} />;
            // }
            // case 'Receipt Number': {
            //   return <ReceiptNumber charge={charge} />;
            // }
            // case 'Receipt URL': {
            //   return <ReceiptUrl charge={charge} />;
            // }
            // case 'Links': {
            //   return <Links charge={charge} />;
            // }
          }
          return <td>missing impl</td>;
        })}
      </tr>
      <tr>
        <td colSpan={columns.length}>
          {charge.ledgerRecords && charge.ledgerRecords.length > 0 ? (
            <LedgerRecordsTable ledgerRecords={charge.ledgerRecords} />
          ) : (
            <p>No ledger records for this charge</p>
          )}
        </td>
      </tr>
    </>
  );
};
