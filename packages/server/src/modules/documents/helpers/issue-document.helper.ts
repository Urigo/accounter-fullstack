import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { _DOLLAR_defs_Document } from '@accounter/green-invoice-graphql';
import type {
  DocumentDraft,
  DocumentIncomeRecord,
  DocumentIssueInput,
  DocumentLinkType,
  DocumentPaymentRecord,
  DocumentVatType,
  PaymentType,
  ResolversTypes,
} from '../../../__generated__/types.js';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetContractsByIdsResult } from '../../contracts/types.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from '../../financial-accounts/providers/financial-bank-accounts.provider.js';
import type { IGetFinancialBankAccountsByIdsResult } from '../../financial-accounts/types.js';
import { validateClientIntegrations } from '../../financial-entities/helpers/clients.helper.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '../../financial-entities/providers/clients.provider.js';
import {
  convertDocumentInputIntoGreenInvoiceInput,
  getTypeFromGreenInvoiceDocument,
  getVatTypeFromGreenInvoiceDocument,
  insertNewDocumentFromGreenInvoice,
} from '../../green-invoice/helpers/green-invoice.helper.js';
import type { IGetTransactionsByChargeIdsResult } from '../../transactions/types.js';
import { IssuedDocumentsProvider } from '../providers/issued-documents.provider.js';
import { normalizeDocumentType } from '../resolvers/common.js';
import type { IGetIssuedDocumentsByIdsResult } from '../types.js';

export async function getPaymentsFromTransactions(
  injector: Injector,
  transactions: IGetTransactionsByChargeIdsResult[],
): Promise<DocumentPaymentRecord[]> {
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
      let type: PaymentType = 'OTHER';
      switch (account.type) {
        case 'BANK_ACCOUNT':
          type = 'WIRE_TRANSFER';
          break;
        case 'CREDIT_CARD':
          type = 'CREDIT_CARD';
          break;
      }

      let bankAccount: IGetFinancialBankAccountsByIdsResult | undefined = undefined;
      if (account.type === 'BANK_ACCOUNT') {
        bankAccount = await injector
          .get(FinancialBankAccountsProvider)
          .getFinancialBankAccountByIdLoader.load(account.id);
        if (!bankAccount) {
          throw new GraphQLError(
            `Bank account details not found for financial account ID "${account.id}"`,
          );
        }
      }

      // get further fields
      let paymentTypeSpecificAttributes: Partial<DocumentPaymentRecord> = {};
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
            numPayments: 1,
            firstPayment: transaction.event_date.getTime() / 1000, // assuming first payment is the transaction date
          };
          break;
        case 'WIRE_TRANSFER':
          paymentTypeSpecificAttributes = {
            bankName: bankAccount?.bank_number?.toString(),
            bankBranch: bankAccount?.branch_number?.toString(),
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
        case 'OTHER1':
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

      const payment: DocumentPaymentRecord = {
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

export function getIncomeRecordsFromDocuments(
  greenInvoiceDocuments: _DOLLAR_defs_Document[],
): DocumentIncomeRecord[] {
  const incomes = greenInvoiceDocuments
    .map(greenInvoiceDocument => {
      return greenInvoiceDocument.income.filter(Boolean).map(originIncome => {
        if (!originIncome?.currency) {
          throw new Error('Income currency is missing');
        }
        const income: DocumentIncomeRecord = {
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
  documents: { type: DocumentType }[],
  transactions: IGetTransactionsByChargeIdsResult[],
): DocumentType {
  if (!documents.length) {
    if (transactions.length) {
      return DocumentType.InvoiceReceipt;
    }
    return DocumentType.Proforma;
  }

  const documentsTypes = new Set<DocumentType>(documents.map(doc => doc.type));

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
): Pick<DocumentDraft, 'linkedDocumentIds' | 'linkType'> {
  const linkedDocumentIds = issuedDocuments.map(doc => doc.external_id);
  let linkType: DocumentLinkType | undefined = undefined;
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

export async function deduceVatTypeFromBusiness(
  injector: Injector,
  locality: string,
  businessId?: string | null,
): Promise<DocumentVatType> {
  if (!businessId) return 'DEFAULT';

  const business = await injector.get(BusinessesProvider).getBusinessByIdLoader.load(businessId);
  if (!business) return 'DEFAULT';

  // Deduce VAT type based on business information
  if (business.country === locality && !business.exempt_dealer) {
    return 'MIXED';
  }

  return 'EXEMPT';
}

export const convertContractToDraft = async (
  contract: IGetContractsByIdsResult,
  injector: Injector,
  issueMonth: TimelessDateString,
) => {
  const businessPromise = injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(contract.client_id);
  const clientPromise = injector.get(ClientsProvider).getClientByIdLoader.load(contract.client_id);
  const [business, client] = await Promise.all([businessPromise, clientPromise]);

  if (!business) {
    throw new GraphQLError(`Business ID="${contract.client_id}" not found`);
  }

  if (!client) {
    throw new GraphQLError(`Client not found for business ID="${contract.client_id}"`);
  }

  const greenInvoiceId = validateClientIntegrations(client.integrations)?.greenInvoiceId;

  if (!greenInvoiceId) {
    throw new GraphQLError(`Green invoice match not found for business ID="${contract.client_id}"`);
  }

  const today = issueMonth ? addMonths(new Date(issueMonth), 1) : new Date();
  const monthStart = dateToTimelessDateString(startOfMonth(today));
  const monthEnd = dateToTimelessDateString(endOfMonth(today));
  const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
  const month = format(subMonths(today, 1), 'MMMM');

  const documentInput: ResolversTypes['DocumentDraft'] = {
    remarks: `${contract.purchase_orders[0] ? `PO: ${contract.purchase_orders[0]}${contract.remarks ? ', ' : ''}` : ''}${contract.remarks ?? ''}`,
    description: `GraphQL Hive Enterprise License - ${month} ${year}`,
    type: normalizeDocumentType(contract.document_type),
    date: monthStart,
    dueDate: monthEnd,
    language: 'ENGLISH',
    currency: contract.currency as Currency,
    vatType: 'EXEMPT',
    rounding: false,
    signed: true,
    client,
    income: [
      {
        description: `GraphQL Hive Enterprise License - ${month} ${year}`,
        quantity: 1,
        price: contract.amount,
        currency: contract.currency as Currency,
        vatType: 'EXEMPT',
      },
    ],
  };

  return documentInput;
};

export async function executeDocumentIssue(
  injector: Injector,
  adminBusinessId: string,
  initialInput: DocumentIssueInput,
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

    // validate all linked documents are closed
    if (input.linkedDocumentIds?.length) {
      await Promise.all(
        input.linkedDocumentIds.map(async id => {
          if (id) {
            await injector
              .get(GreenInvoiceClientProvider)
              .closeDocument(id)
              .catch(e => {
                const message = `ERROR: Failed to close Green Invoice linked document with ID ${id}`;
                console.error(`${message}: ${e}`);
              });
          }
        }),
      );
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
      if (getTypeFromGreenInvoiceDocument(coreInput.type) === DocumentType.CreditInvoice) {
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
