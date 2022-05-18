import gql from 'graphql-tag';
import { CSSProperties, useState } from 'react';
import { suggestedCharge } from '../../helpers';
import type { TransactionColumn } from '../../models/types';
import { ChargesFieldsFragment, VatFieldsFragment } from '../../__generated__/types';
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
  ReceiptDate,
  ReceiptImg,
  ReceiptNumber,
  ReceiptUrl,
  ShareWith,
  Vat,
} from './cells';
import { LedgerRecordsTable } from './ledgerRecords/LedgerRecordsTable';

gql`
  fragment chargesFields on FinancialEntity {
    ...vatFields
    ...shareWithFields
    charges {
      id
      ...dateFields
      ...amountFields
      ...entityFields
      ...descriptionFields
      ...categoryFields
      ...accountFields
      ...bankDescriptionFields
      ...ledgerRecordsFields
      ...suggestedCharge
      ...invoiceImageFields
      ...invoiceDateFields
      ...invoiceNumberFields
      ...invoiceFileFields
      ...receiptImageFields
      ...receiptDateFields
      ...receiptNumberFields
      ...receiptUrlFields
    }
  }
`;

gql`
  fragment suggestedCharge on Charge {
    transactions {
      __typename
      amount {
        raw
      }
      userNote
      referenceNumber
      description
    }
  }
`;

type Props = {
  columns: TransactionColumn[];
  index: number;
  charge: ChargesFieldsFragment['charges']['0'];
  financialEntityType: VatFieldsFragment['__typename'];
  financialEntityName?: string;
};

const rowStyle = ({ hover, index }: { hover: boolean; index: number }): CSSProperties => ({
  backgroundColor: hover ? '#f5f5f5' : index % 2 == 0 ? '#CEE0CC' : undefined,
});

export const ChargeRow = ({ columns, index, charge, financialEntityType, financialEntityName = '' }: Props) => {
  const [hover, setHover] = useState(false);
  const alternativeCharge =
    !charge.counterparty.name ||
    !charge.transactions[0].userNote?.trim() ||
    charge.tags.length === 0 ||
    !charge.vat ||
    charge.beneficiaries.length === 0
      ? suggestedCharge(charge)
      : undefined;

  const isBusiness = financialEntityType === 'LtdFinancialEntity';

  return (
    <>
      <tr style={rowStyle({ hover, index })} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        {columns.map(column => {
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
              return <Amount amount={charge.transactions[0].amount.formatted} />;
            }
            case 'Entity': {
              return <Entity data={charge} alternativeCharge={alternativeCharge} />;
            }
            case 'Description': {
              return <Description data={charge.transactions[0]} alternativeCharge={alternativeCharge} />;
            }
            case 'Category': {
              return <Category data={charge} alternativeCharge={alternativeCharge} />;
            }
            case 'VAT': {
              return (
                <Vat
                  vat={charge.vat}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                  amount={charge.transactions[0].amount.raw}
                  alternativeCharge={alternativeCharge}
                ></Vat>
              );
            }
            case 'Account': {
              return <Account account={charge.transactions[0].account} />;
            }
            case 'Share with': {
              return (
                <ShareWith
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                  alternativeCharge={alternativeCharge}
                />
              );
            }
            case 'Bank Description': {
              return <BankDescription description={charge.transactions[0].description} />;
            }
            case 'Invoice Img': {
              return <InvoiceImg data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Invoice Date': {
              return <InvoiceDate data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Invoice Number': {
              return <InvoiceNumber data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Invoice File': {
              return <InvoiceFile data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Receipt Image': {
              return <ReceiptImg data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Receipt Date': {
              return <ReceiptDate data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Receipt Number': {
              return <ReceiptNumber data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            case 'Receipt URL': {
              return <ReceiptUrl data={charge} isBusiness={isBusiness} financialEntityName={financialEntityName} />;
            }
            // case 'Links': {
            //   return <Links charge={charge} />;
            // }
            default: {
              return <td>missing impl</td>;
            }
          }
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
