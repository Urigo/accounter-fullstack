import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { Document } from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import {
  IGetDocumentsByChargeIdResult,
  IGetIssuedDocumentsByIdsResult,
} from '@modules/documents/types';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { DocumentType } from '@shared/enums';
import {
  Currency,
  GreenInvoiceClient,
  GreenInvoiceIncome,
  GreenInvoiceLinkType,
  GreenInvoicePayment,
  GreenInvoicePaymentType,
  GreenInvoiceVatType,
  NewDocumentInfo,
  NewDocumentInput,
} from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import {
  convertDocumentInputIntoGreenInvoiceInput,
  getGreenInvoiceDocumentType,
  getVatTypeFromGreenInvoiceDocument,
  insertNewDocumentFromGreenInvoice,
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
          description: originIncome.description,
          quantity: originIncome.quantity,
          price: originIncome.price,
          currency: originIncome.currency as Currency,
          currencyRate: undefined,
          vatRate: originIncome.vatRate,
          itemId: originIncome.itemId,
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
  shouldCancel: boolean = false,
): Pick<NewDocumentInfo, 'linkedDocumentIds' | 'linkType'> {
  const linkedDocumentIds = issuedDocuments.map(doc => doc.external_id);
  let linkType: GreenInvoiceLinkType | undefined = undefined;
  if (linkedDocumentIds.length) {
    if (shouldCancel) {
      linkType = 'CANCEL';
    } else {
      linkType = 'LINK';
    }
  }
  return {
    linkedDocumentIds,
    linkType,
  };
}

export function getDocumentDateOutOfTransactions(
  transactions: IGetTransactionsByChargeIdsResult[],
): TimelessDateString | undefined {
  const debitDates = transactions.map(tx => tx.debit_date).filter(Boolean) as Date[];

  // if no debit dates, use current date
  if (!debitDates.length) return dateToTimelessDateString(new Date());

  // Sort dates and take the first one
  const sortedDates = [...debitDates].sort((a, b) => b.getTime() - a.getTime());
  const firstDate = sortedDates[0];

  // Return the date in the required format
  return dateToTimelessDateString(firstDate);
}

export async function getClientFromGreenInvoiceClient(
  injector: Injector,
  businessId: string,
  useGreenInvoiceId = false,
): Promise<GreenInvoiceClient | undefined> {
  const client = await injector.get(ClientsProvider).getClientByIdLoader.load(businessId);
  if (!client) {
    return useGreenInvoiceId ? undefined : { id: businessId };
  }

  const greenInvoiceClient = await injector
    .get(GreenInvoiceClientProvider)
    .clientLoader.load(client.green_invoice_id);

  if (!greenInvoiceClient) {
    return useGreenInvoiceId ? undefined : { id: businessId };
  }

  return {
    id: useGreenInvoiceId && greenInvoiceClient.id ? greenInvoiceClient.id : businessId,
    country: greenInvoiceClient.country,
    emails: [
      ...((greenInvoiceClient.emails?.filter(Boolean) as string[]) ?? []),
      'ap@the-guild.dev',
    ],
    name: greenInvoiceClient.name,
    phone: greenInvoiceClient.phone,
    taxId: greenInvoiceClient.taxId,
    address: greenInvoiceClient.address,
    city: greenInvoiceClient.city,
    zip: greenInvoiceClient.zip,
    fax: greenInvoiceClient.fax,
    mobile: greenInvoiceClient.mobile,
  };
}

export async function deduceVatTypeFromBusiness(
  injector: Injector,
  locality: string,
  businessId?: string | null,
): Promise<GreenInvoiceVatType> {
  if (!businessId) return 'DEFAULT';

  const business = await injector.get(BusinessesProvider).getBusinessByIdLoader.load(businessId);
  if (!business) return 'DEFAULT';

  // Deduce VAT type based on business information
  if (business.country === locality) {
    return 'MIXED';
  }

  return 'EXEMPT';
}

export async function executeDocumentIssue(
  injector: Injector,
  adminBusinessId: string,
  initialInput: NewDocumentInput,
  emailContent?: string,
  attachment = true,
  chargeId?: string,
  sendEmail = false,
) {
  try {
    const coreInput = await convertDocumentInputIntoGreenInvoiceInput(initialInput, injector);
    const input = {
      ...coreInput,
      client:
        !coreInput.client || sendEmail
          ? coreInput.client
          : {
              ...coreInput.client,
              emails: [], // if client exists, and sendEmail is false, we don't want to send emails
            },
      emailContent,
      attachment,
    };
    const document = await injector.get(GreenInvoiceClientProvider).addDocuments({ input });

    if (!document) {
      throw new GraphQLError('Failed to issue new document');
    }

    if ('id' in document && document.id) {
      const greenInvoiceDocument = await injector
        .get(GreenInvoiceClientProvider)
        .documentLoader.load(document.id);
      if (!greenInvoiceDocument) {
        console.error('Failed to fetch issued document from Green Invoice', document);
        throw new GraphQLError('Failed to issue new document');
      }

      // Insert new issued document to DB
      const newDocument = await insertNewDocumentFromGreenInvoice(
        injector,
        greenInvoiceDocument,
        adminBusinessId,
        chargeId,
      );

      if (!newDocument.charge_id) {
        console.error('New document does not have a charge ID', newDocument);
        throw new GraphQLError('Failed to issue new document');
      }

      // Close linked documents
      if (coreInput.linkedDocumentIds?.length) {
        await Promise.all(
          coreInput.linkedDocumentIds.map(async id => {
            if (id) {
              await injector
                .get(IssuedDocumentsProvider)
                .updateIssuedDocumentByExternalId({ externalId: id, status: 'CLOSED' })
                .catch(e => {
                  const message = `Failed to close linked document with ID ${id}`;
                  console.error(`${message}: ${e}`);
                  throw new Error(message);
                });
            }
          }),
        );
      }
      if (coreInput.type === getGreenInvoiceDocumentType(DocumentType.CreditInvoice)) {
        // Close origin
      }

      return injector.get(ChargesProvider).getChargeByIdLoader.load(newDocument.charge_id);
    }

    console.error('Document issue failed', document);
    throw new GraphQLError('Document issue failed');
  } catch (error) {
    console.error('Error issuing document:', error);
    throw new GraphQLError('Error issuing document');
  }
}
