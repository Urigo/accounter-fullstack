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
import {
  addMonthsToTimelessDate,
  endOfTimelessMonth,
  maxTimelessDate,
  startOfTimelessMonth,
  timelessDateToTenantInstant,
  todayTimelessDate,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { AdminContext } from '../../admin-context/types.js';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { buildContractDocumentDescription } from '../../contracts/helpers/contracts.helper.js';
import type { IGetContractsByIdsResult } from '../../contracts/types.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import { FinancialBankAccountsProvider } from '../../financial-accounts/providers/financial-bank-accounts.provider.js';
import type { IGetFinancialBankAccountsByIdsResult } from '../../financial-accounts/types.js';
import { parseStoredClientIntegrations } from '../../financial-entities/helpers/clients.helper.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '../../financial-entities/providers/clients.provider.js';
import {
  convertDocumentInputIntoGreenInvoiceInput,
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
            // assuming first payment is the transaction date (Unix seconds, at the tenant's midnight)
            firstPayment: timelessDateToTenantInstant(transaction.event_date).getTime() / 1000, // TODO: make sure Green Invoice uses this timestamp correctly, add some tests to validate our side
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

      const payment: DocumentPaymentRecord = {
        currency: transaction.currency as Currency,
        currencyRate: undefined,
        date: transaction.debit_date ?? transaction.event_date,
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

/**
 * Resolves the type of a document drafted out of an issued one, and whether it cancels that
 * document. An invoice-receipt settles itself, so the only document to issue out of one is a credit
 * invoice; any other document gets the type deduced from it, unless a type is requested. A credit
 * invoice draft defaults to cancelling the document (the issue form can downgrade that to a plain
 * link for a partial credit). Green Invoice issues an invoice-receipt already closed, so one can be
 * credited while closed; an invoice must still be open, and nothing else can be credited.
 */
export function getDraftTypeOutOfIssuedDocument({
  documentId,
  documentType,
  status,
  requestedType,
}: {
  documentId: string;
  documentType: DocumentType;
  status: IGetIssuedDocumentsByIdsResult['status'];
  requestedType?: DocumentType | null;
}): { type: DocumentType; isCancellation: boolean } {
  const type =
    requestedType ??
    (documentType === DocumentType.InvoiceReceipt
      ? DocumentType.CreditInvoice
      : // with a document to go by, the deduced type doesn't depend on the charge's transactions
        getTypeFromDocumentsAndTransactions([{ type: documentType }], []));

  const isCancellation = type === DocumentType.CreditInvoice;
  if (!isCancellation) {
    if (status !== 'OPEN') {
      throw new GraphQLError(`Document with ID "${documentId}" is closed`);
    }
    return { type, isCancellation };
  }

  if (documentType !== DocumentType.Invoice && documentType !== DocumentType.InvoiceReceipt) {
    throw new GraphQLError(
      `Document with ID "${documentId}" can't be cancelled by a credit invoice - only invoices and invoice-receipts can`,
    );
  }
  const isCancellable =
    status === 'OPEN' || (documentType === DocumentType.InvoiceReceipt && status === 'CLOSED');
  if (!isCancellable) {
    throw new GraphQLError(
      `Document with ID "${documentId}" can't be cancelled - its status is ${status}`,
    );
  }
  return { type, isCancellation };
}

/**
 * Only a credit invoice cancels the documents it links to. The issue form lets the type change after
 * the draft set the link type, so a mismatch is rejected before it reaches Green Invoice.
 */
export function validateDocumentLinkType(
  input: Pick<DocumentIssueInput, 'type' | 'linkType'>,
): void {
  if (input.linkType === 'CANCEL' && input.type !== DocumentType.CreditInvoice) {
    throw new GraphQLError(
      `Only a credit invoice can cancel the documents it links to - got ${input.type}`,
    );
  }
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
  // the latest debit date; if there are none, use the current date
  return maxTimelessDate(...transactions.map(tx => tx.debit_date)) ?? todayTimelessDate();
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

export function createRemarks(contract: IGetContractsByIdsResult): string {
  const remarks: string[] = [];
  if (contract.purchase_orders?.length) {
    const lastPo = contract.purchase_orders[contract.purchase_orders.length - 1];
    if (lastPo) {
      remarks.push(`PO: ${lastPo}`);
    }
  }
  if (contract.remarks) {
    remarks.push(contract.remarks);
  }
  return remarks.join(', ');
}

export const convertContractToDraft = async (
  injector: Injector,
  contract: IGetContractsByIdsResult,
  locality: AdminContext['locality'],
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

  const greenInvoiceId = parseStoredClientIntegrations(client.integrations)?.greenInvoiceId;

  if (!greenInvoiceId) {
    throw new GraphQLError(`Green invoice match not found for business ID="${contract.client_id}"`);
  }

  const nextMonth = addMonthsToTimelessDate(issueMonth, 1);
  const monthStart = startOfTimelessMonth(nextMonth);
  const monthEnd = endOfTimelessMonth(nextMonth);

  const description = buildContractDocumentDescription(contract, issueMonth);

  const vatType = await deduceVatTypeFromBusiness(injector, locality, contract.client_id);

  const documentInput: ResolversTypes['DocumentDraft'] = {
    remarks: createRemarks(contract),
    description,
    type: normalizeDocumentType(contract.document_type),
    date: monthStart,
    dueDate: monthEnd,
    language: 'ENGLISH',
    currency: contract.currency as Currency,
    vatType,
    rounding: false,
    signed: true,
    client,
    income: [
      {
        description,
        quantity: 1,
        price: contract.amount,
        currency: contract.currency as Currency,
        vatType: 'EXEMPT',
      },
    ],
  };

  return documentInput;
};

/**
 * The linked documents (by Green Invoice ID) that are still open. One without a local record is
 * assumed open, so it is closed as before.
 */
async function getOpenLinkedDocumentIds(
  injector: Injector,
  externalIds: string[],
): Promise<string[]> {
  if (!externalIds.length) {
    return [];
  }
  const issuedDocuments = await injector
    .get(IssuedDocumentsProvider)
    .getIssuedDocumentsByExternalIdLoader.loadMany(externalIds);
  return externalIds.filter((_, index) => {
    const issuedDocument = issuedDocuments[index];
    return !issuedDocument || issuedDocument instanceof Error || issuedDocument.status === 'OPEN';
  });
}

export async function executeDocumentIssue(
  injector: Injector,
  adminBusinessId: string,
  initialInput: DocumentIssueInput,
  emailContent?: string,
  attachment = true,
  chargeId?: string,
  sendEmail = false,
) {
  // outside the try, which would replace the reason with a generic error
  validateDocumentLinkType(initialInput);

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

    // A cancelling link makes Green Invoice cancel the linked documents on its own (and closing
    // one that is no longer open fails), so only plainly linked documents are closed here - and
    // only those still open: a partial credit links to an invoice-receipt that is already closed.
    const isCancellation = initialInput.linkType === 'CANCEL';
    const linkedDocumentIds = (coreInput.linkedDocumentIds ?? []).filter(
      (id): id is string => !!id,
    );
    const linkedDocumentIdsToClose = isCancellation
      ? []
      : await getOpenLinkedDocumentIds(injector, linkedDocumentIds);

    const document = await injector.get(GreenInvoiceClientProvider).addDocuments({ input });

    if (!document) {
      throw new GraphQLError('Failed to issue new document');
    }

    // validate all linked documents are closed
    await Promise.all(
      linkedDocumentIdsToClose.map(async id => {
        await injector
          .get(GreenInvoiceClientProvider)
          .closeDocument(id)
          .catch(e => {
            const message = `ERROR: Failed to close Green Invoice linked document with ID ${id}`;
            console.error(`${message}: ${e}`);
          });
      }),
    );

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

      // Close (or mark as cancelled) linked documents
      await Promise.all(
        (isCancellation ? linkedDocumentIds : linkedDocumentIdsToClose).map(async id => {
          await injector
            .get(IssuedDocumentsProvider)
            .updateIssuedDocumentByExternalId({
              externalId: id,
              status: isCancellation ? 'CANCELLED_BY_OTHER_DOC' : 'CLOSED',
            })
            .catch(e => {
              const message = `Failed to close linked document with ID ${id}`;
              console.error(`${message}: ${e}`);
              throw new Error(message);
            });
        }),
      );

      return injector.get(ChargesProvider).getChargeByIdLoader.load(newDocument.charge_id);
    }

    console.error('Document issue failed', document);
    throw new GraphQLError('Document issue failed');
  } catch (error) {
    console.error('Error issuing document:', error);
    throw new GraphQLError('Error issuing document');
  }
}
