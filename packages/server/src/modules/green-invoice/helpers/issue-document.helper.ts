import { Injector } from 'graphql-modules';
import type { Document } from '@accounter/green-invoice-graphql';
import {
  IGetDocumentsByChargeIdResult,
  IGetIssuedDocumentsByIdsResult,
} from '@modules/documents/types';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import {
  Currency,
  GreenInvoiceIncome,
  GreenInvoicePayment,
  GreenInvoicePaymentType,
} from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import {
  getGreenInvoiceDocumentNameFromType,
  getVatTypeFromGreenInvoiceDocument,
} from './green-invoice.helper.js';

export async function getPaymentsFromTransactions(
  injector: Injector,
  transactions: IGetTransactionsByChargeIdsResult[],
): Promise<GreenInvoicePayment[]> {
  const payments = await Promise.all(
    transactions.map(async transaction => {
      // get account
      const account = await injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
      if (!account) {
        throw new Error(`Account with ID ${transaction.account_id} not found`);
      }

      // get account type
      let type: GreenInvoicePaymentType = 'OTHER';
      switch (account.type) {
        case 'BANK_ACCOUNT':
          type = 'WIRE_TRANSFER';
          break;
        case 'CREDIT_CARD':
          type = 'CREDIT_CARD';
          break;
      }

      // get further fields
      let paymentTypeSpecificAttributes: Partial<GreenInvoicePayment> = {};
      switch (type as string) {
        case 'CHEQUE':
          paymentTypeSpecificAttributes = {
            //   chequeNum: _____,
          };
          break;
        case 'CREDIT_CARD':
          paymentTypeSpecificAttributes = {
            cardType: 'MASTERCARD', // TODO: add logic to support other card types
            cardNum: account.account_number,
            dealType: 'STANDARD', // TODO: add logic to support other deal types
            numPayments: 1,
            firstPayment: transaction.event_date.getTime() / 1000, // assuming first payment is the transaction date
          };
          break;
        case 'WIRE_TRANSFER':
          paymentTypeSpecificAttributes = {
            bankName: account.bank_number?.toString(),
            bankBranch: account.branch_number?.toString(),
            bankAccount: account.account_number?.toString(),
          };
          break;
        case 'PAYMENT_APP':
          paymentTypeSpecificAttributes = {
            //   appType: _____,
            //   accountId: _____,
            //   transactionId: _____,
          };
          break;
        case 'OTHER':
          paymentTypeSpecificAttributes = {
            //   subType: _____,
            //   accountId: _____,
            //   transactionId: _____,
          };
          break;
        case 'PAYPAL':
          paymentTypeSpecificAttributes = {
            //   accountId: _____,
            //   transactionId: _____,
          };
          break;
        case 'CASH':
        case 'TAX_DEDUCTION':
        case 'OTHER_DEDUCTION':
          break;
      }

      const payment: GreenInvoicePayment = {
        currency: transaction.currency as Currency,
        currencyRate: Number(transaction.currency_rate),
        date: dateToTimelessDateString(transaction.event_date),
        price: Number(transaction.amount),
        type,
        transactionId: transaction.id,
        accountId: account.id,
        ...paymentTypeSpecificAttributes,
      };
      return payment;
    }),
  );
  return payments;
}

export function getIncomeFromDocuments(
  documents: {
    document: IGetDocumentsByChargeIdResult;
    issuedDocument: IGetIssuedDocumentsByIdsResult;
    greenInvoiceDocument: Document;
  }[],
): GreenInvoiceIncome[] {
  const incomes = documents.map(({ greenInvoiceDocument }) => {
    const income: GreenInvoiceIncome = {
      catalogNum: greenInvoiceDocument.number,
      currency: greenInvoiceDocument.currency as Currency,
      currencyRate: greenInvoiceDocument.currencyRate,
      description:
        greenInvoiceDocument.description && greenInvoiceDocument.description !== ''
          ? greenInvoiceDocument.description
          : (greenInvoiceDocument.remarks ??
            `${getGreenInvoiceDocumentNameFromType(greenInvoiceDocument.type)} ${greenInvoiceDocument.number}`),
      itemId: greenInvoiceDocument.id,
      price: greenInvoiceDocument.amount,
      quantity: 1,
      vat: greenInvoiceDocument.vat,
      vatRate: greenInvoiceDocument.vatRate,
      vatType: getVatTypeFromGreenInvoiceDocument(greenInvoiceDocument.vatType),
    };
    return income;
  });
  return incomes;
}
