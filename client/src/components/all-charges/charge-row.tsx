import gql from 'graphql-tag';
import { CSSProperties, useState } from 'react';
import { suggestedCharge } from '../../helpers';
import type { TransactionColumn } from '../../models/types';
import { ChargesFieldsFragment, SuggestedChargeFragment } from '../../__generated__/types';
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
import { LedgerRecordsTable } from './ledger-records/ledger-records-table';

gql`
  fragment ChargesFields on FinancialEntity {
    ...SuggestedCharge
    charges {
      id
      ...DateFields
      ...AmountFields
      ...EntityFields
      ...DescriptionFields
      ...CategoryFields
      ...VatFields
      ...AccountFields
      ...ShareWithFields
      ...BankDescriptionFields
      ...LedgerRecordsFields
      ...InvoiceImageFields
      ...InvoiceDateFields
      ...InvoiceNumberFields
      ...InvoiceFileFields
      ...ReceiptImageFields
      ...ReceiptDateFields
      ...ReceiptNumberFields
      ...ReceiptUrlFields
    }
  }
`;

gql`
  fragment SuggestedCharge on FinancialEntity {
    __typename
    charges {
      transactions {
        __typename
        amount {
          raw
        }
        userNote
        referenceNumber
        description
      }
      counterparty {
        name
      }
    }
  }
`;

type Props = {
  columns: TransactionColumn[];
  index: number;
  charge: ChargesFieldsFragment['charges']['0'];
  financialEntityType: SuggestedChargeFragment['__typename'];
};

export const ChargeRow = ({ columns, charge, financialEntityType }: Props) => {
  const alternativeCharge =
    !charge.counterparty?.name ||
    !charge.transactions[0].userNote?.trim() ||
    charge.tags.length === 0 ||
    !charge.vat?.raw ||
    charge.beneficiaries.length === 0
      ? suggestedCharge(charge)
      : undefined;

  const isBusiness = financialEntityType === 'LtdFinancialEntity';
  const financialEntityName = charge.counterparty?.name ?? '';

  return (
    <>
      <tr>
        {columns.map((column, i) => {
          switch (column) {
            case 'Date': {
              return (
                <Date
                  key={column}
                  createdAt={charge.transactions[0].createdAt}
                  effectiveDate={charge.transactions[0].effectiveDate}
                />
              );
            }
            case 'Amount': {
              return <Amount key={column} amount={charge.transactions[0].amount.formatted} />;
            }
            case 'Entity': {
              return <Entity key={column} data={charge} alternativeCharge={alternativeCharge} />;
            }
            case 'Description': {
              return <Description key={column} data={charge.transactions[0]} alternativeCharge={alternativeCharge} />;
            }
            case 'Category': {
              return <Category key={column} data={charge} alternativeCharge={alternativeCharge} />;
            }
            case 'VAT': {
              return (
                <Vat
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                  alternativeCharge={alternativeCharge}
                ></Vat>
              );
            }
            case 'Account': {
              return <Account key={column} account={charge.transactions[0].account} />;
            }
            case 'Share with': {
              return (
                <ShareWith
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                  alternativeCharge={alternativeCharge}
                />
              );
            }
            case 'Bank Description': {
              return <BankDescription key={column} description={charge.transactions[0].description} />;
            }
            case 'Invoice Img': {
              return (
                <InvoiceImg
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Invoice Date': {
              return (
                <InvoiceDate
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Invoice Number': {
              return (
                <InvoiceNumber
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Invoice File': {
              return (
                <InvoiceFile
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Receipt Image': {
              return (
                <ReceiptImg
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Receipt Date': {
              return (
                <ReceiptDate
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Receipt Number': {
              return (
                <ReceiptNumber
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            case 'Receipt URL': {
              return (
                <ReceiptUrl
                  key={column}
                  data={charge}
                  isBusiness={isBusiness}
                  financialEntityName={financialEntityName}
                />
              );
            }
            // case 'Links': {
            //   return <Links charge={charge} />;
            // }
            default: {
              return <td key={i}>missing impl</td>;
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
