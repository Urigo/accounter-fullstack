import { endOfDay, startOfDay } from 'date-fns';
import type { Injector } from 'graphql-modules';
import { DeelClientProvider } from '@modules/app-providers/deel/deel-client.provider.js';
import type {
  DeelWorker,
  Invoice,
  PaymentBreakdownRecord,
  PaymentReceipts,
} from '@modules/app-providers/deel/schemas.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { uploadToCloudinary } from '@modules/documents/helpers/upload.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import type {
  IGetDocumentsByChargeIdResult,
  IInsertDocumentsParams,
} from '@modules/documents/types';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { Currency, DocumentType } from '@shared/enums';
import { dateToTimelessDateString } from '@shared/helpers';
import type { LedgerProto, StrictLedgerProto } from '@shared/types';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
import type { IInsertDeelInvoiceRecordsParams } from '../types.js';

const DEEL_BUSINESS_ID = '8d34f668-7233-4ce3-9c9c-82550b0839ff'; // TODO: replace with DB based business id

export function isDeelDocument(document: IGetDocumentsByChargeIdResult): boolean {
  const isDeelSide =
    document.creditor_id === DEEL_BUSINESS_ID || document.debtor_id === DEEL_BUSINESS_ID;
  const isFinancialDocument =
    document.type === 'INVOICE' ||
    document.type === 'INVOICE_RECEIPT' ||
    document.type === 'CREDIT_INVOICE';

  return isDeelSide && isFinancialDocument;
}

export async function getDeelEmployeeId(
  context: GraphQLModules.ModuleContext,
  document: IGetDocumentsByChargeIdResult,
  ledgerEntry: StrictLedgerProto,
  ledgerEntries: LedgerProto[],
  updateLedgerBalance: (entry: LedgerProto) => void,
): Promise<void> {
  if (!isDeelDocument(document)) {
    return;
  }

  const isDeelCreditor = ledgerEntry.creditAccountID1 === DEEL_BUSINESS_ID;
  // naive fetch employee id from deel
  let employeeId = await context.injector
    .get(DeelContractsProvider)
    .getEmployeeIdByDocumentIdLoader.load(document.id);

  if (!employeeId && document.date && document.type) {
    // figure out through deel records
    const records = await context.injector
      .get(DeelInvoicesProvider)
      .getInvoicesByIssueDates(startOfDay(document.date), endOfDay(document.date));

    const matchingRecord = records.find(r => {
      if (dateToTimelessDateString(r.issued_at) !== dateToTimelessDateString(document.date!)) {
        return false;
      }
      if (r.label !== document.serial_number) {
        return false;
      }
      if (r.currency !== document.currency_code) {
        return false;
      }
      if (Number(r.total) !== document.total_amount) {
        if (records.length === 1) {
          return false;
        }
        const spreadRecords = records.filter(r => r.label === document.serial_number);
        if (spreadRecords.length === 1) {
          return false;
        }
        const totalAmount = spreadRecords.reduce((acc, r) => acc + Number(r.amount), 0);
        if (totalAmount !== document.total_amount) {
          return false;
        }
      }
      return true;
    });
    if (matchingRecord?.contract_id) {
      employeeId = await context.injector
        .get(DeelContractsProvider)
        .getEmployeeIDByContractIdLoader.load(matchingRecord.contract_id);
    }
  }

  if (employeeId) {
    // get employee tax category
    const taxCategoryId = await context.injector
      .get(TaxCategoriesProvider)
      .taxCategoryByBusinessAndOwnerIDsLoader.load({
        businessId: employeeId,
        ownerId: context.adminContext.defaultAdminBusinessId,
      })
      .then(taxCategory => taxCategory?.id);
    let newEntry: LedgerProto;
    if (isDeelCreditor) {
      newEntry = {
        ...ledgerEntry,
        debitAccountID1: employeeId,
      };
      ledgerEntry.creditAccountID1 = employeeId;
      ledgerEntry.debitAccountID1 = taxCategoryId ?? ledgerEntry.debitAccountID1;
    } else {
      newEntry = {
        ...ledgerEntry,
        creditAccountID1: employeeId,
      };
      ledgerEntry.creditAccountID1 = taxCategoryId ?? ledgerEntry.creditAccountID1;
      ledgerEntry.debitAccountID1 = employeeId;
    }
    updateLedgerBalance(newEntry);
    ledgerEntries.push(newEntry);
  }

  return;
}

type Prefixer<Type> = {
  [Property in keyof Type as `breakdown_${string & Property}`]: Type[Property];
};
export type PrefixedBreakdown = Prefixer<PaymentBreakdownRecord & { receipt_id: string }>;
export type DeelInvoiceMatch = Invoice & PrefixedBreakdown;

export async function uploadDeelInvoice(
  receiptChargeMap: Map<string, string>,
  match: DeelInvoiceMatch,
  injector: Injector,
  ownerId: string,
): Promise<string> {
  try {
    const chargeId = receiptChargeMap.get(match.breakdown_receipt_id as string);
    if (!chargeId) {
      throw new Error('Charge not found for invoice');
    }

    // fetch file from Deel
    const file = await injector.get(DeelClientProvider).getSalaryInvoiceFile(match.id);

    // upload file to cloudinary
    const { fileUrl, imageUrl } = await uploadToCloudinary(injector, file);

    // create the new document object
    const newDocumentFromInvoice: IInsertDocumentsParams['document'][number] = {
      image: imageUrl ?? null,
      file: fileUrl ?? null,
      documentType: DocumentType.Invoice,
      serialNumber: match.label,
      date: match.issued_at,
      amount: Number(match.breakdown_total_payment_currency),
      currencyCode: match.breakdown_payment_currency as Currency,
      vat: Number(match.vat_total),
      chargeId,
      vatReportDateOverride: null,
      noVatAmount: null,
      debtorId: ownerId,
      creditorId: DEEL_BUSINESS_ID,
      allocationNumber: null,
    };

    // upload the document
    const [document] = await injector.get(DocumentsProvider).insertDocuments({
      document: [newDocumentFromInvoice],
    });

    if (!document.id) {
      throw new Error('Document not uploaded to DB');
    }

    return document.id;
  } catch (error) {
    console.error(error);
    throw new Error('Error uploading Deel invoice');
  }
}

function nullifyEmptyStrings(raw: string) {
  return raw === '' ? null : raw;
}

export function convertMatchToDeelInvoiceRecord(
  match: DeelInvoiceMatch,
  documentId: string,
): IInsertDeelInvoiceRecordsParams {
  return {
    adjustment: match.breakdown_adjustment,
    amount: match.amount,
    approveDate: nullifyEmptyStrings(match.breakdown_approve_date),
    approvers: match.breakdown_approvers,
    bonus: match.breakdown_bonus,
    commissions: match.breakdown_commissions,
    contractCountry: nullifyEmptyStrings(match.breakdown_contract_country),
    contractId: match.contract_id,
    contractStartDate: nullifyEmptyStrings(match.breakdown_contract_start_date),
    contractorEmail: nullifyEmptyStrings(match.breakdown_contractor_email),
    contractorEmployeeName: match.breakdown_contractor_employee_name,
    contractorUniqueIdentifier: nullifyEmptyStrings(match.breakdown_contractor_unique_identifier),
    createdAt: match.created_at,
    currency: match.currency as Currency,
    deductions: match.breakdown_deductions,
    deelFee: match.deel_fee,
    documentId,
    dueDate: match.due_date,
    expenses: match.breakdown_expenses,
    frequency: nullifyEmptyStrings(match.breakdown_frequency),
    generalLedgerAccount: nullifyEmptyStrings(match.breakdown_general_ledger_account),
    id: match.id,
    isOverdue: match.is_overdue,
    issuedAt: match.issued_at,
    label: match.label,
    others: match.breakdown_others,
    overtime: match.breakdown_overtime,
    paidAt: match.paid_at,
    paymentCurrency: match.breakdown_payment_currency as Currency,
    paymentId: match.breakdown_receipt_id,
    processingFee: match.breakdown_processing_fee,
    proRata: match.breakdown_pro_rata,
    status: match.status,
    total: match.total,
    totalPaymentCurrency: match.breakdown_total_payment_currency,
    vatId: nullifyEmptyStrings(match.vat_id),
    vatPercentage: nullifyEmptyStrings(match.vat_percentage),
    vatTotal: match.vat_total,
    work: match.breakdown_work,
  };
}

export function getDeelChargeDescription(workers?: DeelWorker[]) {
  const workerNames = workers
    ?.filter(w => w.name)
    .map(w => w.name?.split(' ')[0])
    .filter(w => w && w !== 'Deel');
  const workersDescription = workerNames?.length ? ` for ${workerNames.join(', ')}` : '';
  const description = `Deel payment${workersDescription}`;
  return description;
}

export async function fetchAndFilterInvoices(injector: Injector) {
  try {
    const invoices = await injector.get(DeelClientProvider).getSalaryInvoices(); // TODO: enable setting up period

    const filteredInvoices: Invoice[] = [];
    const knownReceiptIds = new Set<string>();

    await Promise.all(
      invoices.data.map(async invoice => {
        const dbInvoice = await injector
          .get(DeelInvoicesProvider)
          .getInvoicesByIdLoader.load(invoice.id)
          .catch(e => {
            console.error(e);
            throw new Error('Error fetching invoice');
          });
        if (dbInvoice) {
          knownReceiptIds.add(invoice.id);
        } else {
          filteredInvoices.push(invoice);
        }
      }),
    );

    return { invoices: filteredInvoices, knownReceiptIds };
  } catch (error) {
    console.error(error);
    throw new Error('Error fetching Deel invoices');
  }
}

export async function fetchReceipts(injector: Injector) {
  try {
    const res = await injector.get(DeelClientProvider).getPaymentReceipts(); // TODO: use PERION_IN_MONTHS
    return res.data.rows;
  } catch (error) {
    console.error(error);
    throw new Error('Error fetching Deel receipts');
  }
}

export async function fetchPaymentBreakdowns(injector: Injector, receipts: PaymentReceipts[]) {
  const receiptsBreakDown: Array<PaymentBreakdownRecord & { receipt_id: string }> = [];

  for (const receipt of receipts) {
    if (receipt.id) {
      const breakDown = await injector.get(DeelClientProvider).getPaymentBreakdown(receipt.id);
      receiptsBreakDown.push(...breakDown.data.map(row => ({ ...row, receipt_id: receipt.id })));
    }
  }

  return receiptsBreakDown;
}

export async function getChargeMatchesForPayments(
  injector: Injector,
  ownerId: string,
  receipts: PaymentReceipts[],
  knownReceiptIds: Set<string>,
) {
  const receiptChargeMap = new Map<string, string>();

  await Promise.all(
    Array.from(knownReceiptIds).map(async id =>
      injector
        .get(DeelInvoicesProvider)
        .getChargeIdByPaymentIdLoader.load(id)
        .then(chargeId => {
          if (chargeId) {
            receiptChargeMap.set(id, chargeId);
          }
        }),
    ),
  );

  for (const receipt of receipts) {
    if (receiptChargeMap.has(receipt.id)) {
      continue;
    }
    const description = getDeelChargeDescription(receipt.workers);
    const [charge] = await injector.get(ChargesProvider).generateCharge({
      ownerId,
      userDescription: description,
    });

    receiptChargeMap.set(receipt.id, charge.id);

    // TODO: upload receipt whenever available via Deel API
  }

  return receiptChargeMap;
}

export function matchInvoicesWithPayments(
  invoices: Invoice[],
  paymentBreakdowns: PaymentBreakdownRecord[],
) {
  const matches: DeelInvoiceMatch[] = [];

  invoices.map(invoice => {
    const optionalMatches = paymentBreakdowns.filter(
      receipt =>
        invoice.currency === receipt.currency &&
        invoice.total === receipt.total &&
        invoice.created_at === receipt.date &&
        invoice.paid_at === receipt.payment_date,
    );
    if (optionalMatches.length === 1) {
      const adjustedBreakdown: Record<string, unknown> = {};
      Object.entries(optionalMatches[0]).map(([key, value]) => {
        adjustedBreakdown[`breakdown_${key}`] = value;
      });
      matches.push({ ...(adjustedBreakdown as PrefixedBreakdown), ...invoice });
    } else {
      throw new Error(`No payment match found for invoice ${invoice.id}`);
    }
  });

  return matches;
}
