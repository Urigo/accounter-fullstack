import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { Document } from '@accounter/green-invoice-graphql';
import {
  IGetDocumentsByChargeIdResult,
  IGetIssuedDocumentsByIdsResult,
} from '@modules/documents/types';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { DocumentType } from '@shared/enums';
import {
  Currency,
  GreenInvoiceIncome,
  GreenInvoicePayment,
  GreenInvoicePaymentType,
  NewDocumentInfo,
} from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import {
  getVatTypeFromGreenInvoiceDocument,
  normalizeDocumentType,
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
        currencyRate: undefined,
        date: dateToTimelessDateString(transaction.debit_date ?? transaction.event_date),
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
  const incomes = documents
    .map(({ greenInvoiceDocument }) => {
      return greenInvoiceDocument.income.filter(Boolean).map(originIncome => {
        if (!originIncome?.currency) {
          throw new Error('Income currency is missing');
        }
        const income: GreenInvoiceIncome = {
          ...originIncome,
          currency: originIncome.currency as Currency,
          vatType: getVatTypeFromGreenInvoiceDocument(greenInvoiceDocument.vatType),
        };
        return income;
      });
    })
    .flat();
  return incomes;
}

export function getTypeFromDocumentsAndTransactions(
  greenInvoiceDocuments: Document[],
  transactions: IGetTransactionsByChargeIdsResult[],
): DocumentType {
  if (!greenInvoiceDocuments.length) {
    if (transactions.length) {
      return DocumentType.InvoiceReceipt;
    }
    return DocumentType.Proforma;
  }

  const documentsTypes = new Set<DocumentType>(
    greenInvoiceDocuments.map(doc => normalizeDocumentType(doc.type)),
  );

  if (documentsTypes.size === 1) {
    switch (Array.from(documentsTypes)[0]) {
      case DocumentType.Invoice:
        return DocumentType.Receipt;
      case DocumentType.Proforma:
        return DocumentType.InvoiceReceipt;
    }
  }

  return DocumentType.Proforma;
}

export function filterAndHandleSwiftTransactions(
  originTransactions: IGetTransactionsByChargeIdsResult[],
  swiftBusinessId: string | null,
): IGetTransactionsByChargeIdsResult[] {
  const swiftTransactions: IGetTransactionsByChargeIdsResult[] = [];
  const incomeTransactions: IGetTransactionsByChargeIdsResult[] = [];

  for (const transaction of originTransactions) {
    if (swiftBusinessId && transaction.business_id === swiftBusinessId) {
      swiftTransactions.push(transaction);
    } else if (Number(transaction.amount) > 0) {
      incomeTransactions.push(transaction);
    }
  }

  if (swiftTransactions.length === 0) {
    return incomeTransactions;
  }

  if (swiftTransactions.length === 1 && incomeTransactions.length === 1) {
    const incomeTransaction = incomeTransactions[0];
    return [
      {
        ...incomeTransaction,
        amount: (Number(incomeTransaction.amount) - Number(swiftTransactions[0].amount)).toFixed(2),
      },
    ];
  }

  throw new GraphQLError(
    "Unable to process transactions. Couldn't match swift fees to transactions",
  );
}

export function getLinkedDocumentsAttributes(
  issuedDocuments: IGetIssuedDocumentsByIdsResult[],
): Pick<NewDocumentInfo, 'linkedDocumentIds' | 'linkType'> {
  const linkedDocumentIds = issuedDocuments.map(doc => doc.external_id);
  return {
    linkedDocumentIds,
    linkType: linkedDocumentIds.length ? 'LINK' : undefined,
  };
}

export function getDocumentDateOutOfTransactions(
  transactions: IGetTransactionsByChargeIdsResult[],
): TimelessDateString | undefined {
  const debitDates = transactions.map(tx => tx.debit_date).filter(Boolean) as Date[];

  // if no debit dates, use current date
  if (!debitDates.length) return dateToTimelessDateString(new Date());

  // Sort dates and take the first one
  const sortedDates = debitDates.sort((a, b) => b.getTime() - a.getTime());
  const firstDate = sortedDates[0];

  // Return the date in the required format
  return dateToTimelessDateString(firstDate);
}
