import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { Currency, DocumentType } from '../../../shared/enums.js';
import {
  addDaysToTimelessDate,
  timelessDateToUtcDate,
  utcDateToTimelessDate,
} from '../../../shared/helpers/index.js';
import type { LedgerProto, StrictLedgerProto } from '../../../shared/types/index.js';
import type {
  DeelWorker,
  Invoice,
  PaymentBreakdownRecord,
} from '../../app-providers/deel/schemas.js';
import type {
  IGetDocumentsByChargeIdResult,
  IInsertDocumentsParams,
} from '../../documents/types.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { ProviderCredentialsProvider } from '../../provider-credentials/providers/provider-credentials.provider.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
import type {
  IGetEmployeeIDsByContractIdsResult,
  IInsertDeelInvoiceRecordsParams,
  IUpdateDeelInvoiceRecordsParams,
} from '../types.js';

/**
 * The business entity that represents Deel in the tenant's books — set on the Deel provider
 * integration. Null when Deel is not connected or its business was never chosen.
 */
export async function getDeelBusinessId(injector: Injector): Promise<string | null> {
  const statuses = await injector.get(ProviderCredentialsProvider).getProviderStatuses();
  return statuses.find(status => status.provider === 'deel')?.businessId ?? null;
}

/** Like {@link getDeelBusinessId}, but a missing business is an error the user can act on */
export async function requireDeelBusinessId(injector: Injector): Promise<string> {
  const deelBusinessId = await getDeelBusinessId(injector);
  if (!deelBusinessId) {
    throw new GraphQLError(
      "The Deel business isn't set for this workspace. Choose it in Settings → Provider integrations → Deel, then re-run.",
      { extensions: { code: 'PROVIDER_NOT_CONFIGURED' } },
    );
  }
  return deelBusinessId;
}

/**
 * For ledger generation: the Deel business, resolved only for a charge that has financial
 * documents. A failure to read it is logged and treated as "no Deel business", so it can't break
 * the ledger of charges that have nothing to do with Deel.
 */
export async function getDeelBusinessIdForLedger(
  injector: Injector,
  documents: readonly IGetDocumentsByChargeIdResult[],
): Promise<string | null> {
  if (!documents.some(isFinancialDocument)) {
    return null;
  }
  try {
    return await getDeelBusinessId(injector);
  } catch (error) {
    console.error('Failed reading the Deel business; treating documents as non-Deel:', error);
    return null;
  }
}

function isFinancialDocument(document: IGetDocumentsByChargeIdResult): boolean {
  return (
    document.type === 'INVOICE' ||
    document.type === 'INVOICE_RECEIPT' ||
    document.type === 'CREDIT_INVOICE'
  );
}

export function isDeelDocument(
  document: IGetDocumentsByChargeIdResult,
  deelBusinessId: string | null,
): boolean {
  if (!deelBusinessId) {
    return false;
  }
  const isDeelSide =
    document.creditor_id === deelBusinessId || document.debtor_id === deelBusinessId;
  return isDeelSide && isFinancialDocument(document);
}

export async function getDeelEmployeeId(
  injector: Injector,
  document: IGetDocumentsByChargeIdResult,
  ledgerEntry: StrictLedgerProto,
  ledgerEntries: LedgerProto[],
  updateLedgerBalance: (entry: LedgerProto) => void,
): Promise<void> {
  const deelBusinessId = await getDeelBusinessIdForLedger(injector, [document]);
  if (!isDeelDocument(document, deelBusinessId)) {
    return;
  }

  const isDeelCreditor = ledgerEntry.creditAccountID1 === deelBusinessId;
  // naive fetch employee id from deel
  let employeeId = await injector
    .get(DeelContractsProvider)
    .getEmployeeIdByDocumentIdLoader.load(document.id);

  if (!employeeId && document.date && document.type) {
    // figure out through deel records: Deel documents carry the UTC day of the invoice's
    // `issued_at` instant (see `buildDeelInvoiceDocument`)
    const dayStart = timelessDateToUtcDate(document.date);
    const nextDayStart = timelessDateToUtcDate(addDaysToTimelessDate(document.date, 1));
    const records = await injector
      .get(DeelInvoicesProvider)
      .getInvoicesByIssueDates(dayStart, new Date(nextDayStart.getTime() - 1));

    const matchingRecord = records.find(r => {
      if (utcDateToTimelessDate(r.issued_at) !== document.date) {
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
      employeeId = await injector
        .get(DeelContractsProvider)
        .getEmployeeIDByContractIdLoader.load(matchingRecord.contract_id);
    }
  }

  if (employeeId) {
    // get employee tax category
    const taxCategoryId = await injector
      .get(TaxCategoriesProvider)
      .taxCategoryByBusinessIDsLoader.load(employeeId)
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

export const createDeelInvoiceMatchFromUnmatchedInvoice = (invoice: Invoice): DeelInvoiceMatch => ({
  ...invoice,
  breakdown_receipt_id: '',
  breakdown_adjustment: '0.00',
  breakdown_approve_date: '',
  breakdown_approvers: '',
  breakdown_bonus: '0.00',
  breakdown_commissions: '0.00',
  breakdown_contract_country: '',
  breakdown_contract_id: null,
  breakdown_contract_start_date: '',
  breakdown_contract_type: '',
  breakdown_contractor_email: '',
  breakdown_contractor_employee_name: '',
  breakdown_contractor_pic_url: null,
  breakdown_contractor_unique_identifier: '',
  breakdown_currency: '',
  breakdown_date: '',
  breakdown_deductions: '0.00',
  breakdown_expenses: '0.00',
  breakdown_frequency: '',
  breakdown_general_ledger_account: '',
  breakdown_group_id: '',
  breakdown_invoice_id: '',
  breakdown_others: '0.00',
  breakdown_overtime: '0.00',
  breakdown_payment_currency: invoice.currency,
  breakdown_payment_date: '',
  breakdown_pro_rata: '0.00',
  breakdown_processing_fee: '0.00',
  breakdown_work: '0.00',
  breakdown_total: '',
  breakdown_total_payment_currency: invoice.amount,
});

/**
 * The document row for a Deel invoice. `file` holds the uploaded invoice file's URLs and hash; the
 * document is recorded as issued by the Deel business to the owner.
 */
export function buildDeelInvoiceDocument(params: {
  match: DeelInvoiceMatch;
  chargeId: string;
  ownerId: string;
  deelBusinessId: string;
  file: { fileUrl?: string | null; imageUrl?: string | null; fileHash: string };
}): IInsertDocumentsParams['documents'][number] {
  const { match, chargeId, ownerId, deelBusinessId, file } = params;
  return {
    ownerId,
    image: file.imageUrl ?? null,
    file: file.fileUrl ?? null,
    documentType:
      match.breakdown_contract_type === 'prepaid_billing'
        ? DocumentType.Other
        : match.status === 'refunded'
          ? DocumentType.CreditInvoice
          : DocumentType.Invoice,
    serialNumber: match.label,
    // the UTC day of the `issued_at` instant, as Postgres used to cast the raw string
    date: utcDateToTimelessDate(new Date(match.issued_at)),
    amount: Number(match.breakdown_total_payment_currency),
    currencyCode: match.breakdown_payment_currency as Currency,
    vat: Number(match.vat_total),
    chargeId,
    vatReportDateOverride: null,
    noVatAmount: null,
    debtorId: ownerId,
    creditorId: deelBusinessId,
    allocationNumber: null,
    exchangeRateOverride: null,
    fileHash: file.fileHash,
    description: match.breakdown_contractor_employee_name,
    remarks: match.id,
  };
}

function nullifyEmptyStrings(raw: string) {
  return raw === '' ? null : raw;
}

function nullifyFeeInvoices(contractType: string, contractId: string | null): string | null {
  const feeTypes: readonly string[] = ['payment_processing_fee', 'eor_management_fee', 'unknown'];
  if (feeTypes.includes(contractType)) {
    return null;
  }
  return contractId;
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
    billingType: match.billing_type,
    bonus: match.breakdown_bonus,
    commissions: match.breakdown_commissions,
    contractCountry: nullifyEmptyStrings(match.breakdown_contract_country),
    contractId: nullifyFeeInvoices(match.breakdown_contract_type, match.contract_id),
    contractStartDate: nullifyEmptyStrings(match.breakdown_contract_start_date),
    contractType: nullifyEmptyStrings(match.breakdown_contract_type),
    contractorEmail: nullifyEmptyStrings(match.breakdown_contractor_email),
    contractorEmployeeName: match.breakdown_contractor_employee_name,
    contractorUniqueIdentifier: nullifyEmptyStrings(match.breakdown_contractor_unique_identifier),
    createdAt: match.created_at,
    currency: match.currency as Currency,
    deductions: match.breakdown_deductions,
    deelFee: match.deel_fee,
    documentId,
    documentType: match.document_type,
    dueDate: nullifyEmptyStrings(match.due_date),
    expenses: match.breakdown_expenses,
    frequency: nullifyEmptyStrings(match.breakdown_frequency),
    generalLedgerAccount: nullifyEmptyStrings(match.breakdown_general_ledger_account),
    groupId: nullifyEmptyStrings(match.breakdown_group_id),
    id: match.id,
    isOverdue: match.is_overdue,
    issuedAt: match.issued_at,
    label: match.label,
    others: match.breakdown_others,
    overtime: match.breakdown_overtime,
    paidAt: nullifyEmptyStrings(match.paid_at),
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
    recipientLegalEntityId: match.recipient_legal_entity_id,
  };
}

export function convertMatchToPartialDeelInvoiceRecord(
  match: DeelInvoiceMatch,
): IUpdateDeelInvoiceRecordsParams {
  const updateParams: IUpdateDeelInvoiceRecordsParams = {
    id: match.id,
    adjustment: match.breakdown_adjustment,
    approveDate: nullifyEmptyStrings(match.breakdown_approve_date),
    approvers: match.breakdown_approvers,
    bonus: match.breakdown_bonus,
    commissions: match.breakdown_commissions,
    contractCountry: nullifyEmptyStrings(match.breakdown_contract_country),
    contractId: nullifyFeeInvoices(match.breakdown_contract_type, match.contract_id),
    contractStartDate: nullifyEmptyStrings(match.breakdown_contract_start_date),
    contractType: nullifyEmptyStrings(match.breakdown_contract_type),
    contractorEmail: nullifyEmptyStrings(match.breakdown_contractor_email),
    contractorEmployeeName: match.breakdown_contractor_employee_name,
    contractorUniqueIdentifier: nullifyEmptyStrings(match.breakdown_contractor_unique_identifier),
    deductions: match.breakdown_deductions,
    expenses: match.breakdown_expenses,
    frequency: nullifyEmptyStrings(match.breakdown_frequency),
    generalLedgerAccount: nullifyEmptyStrings(match.breakdown_general_ledger_account),
    groupId: nullifyEmptyStrings(match.breakdown_group_id),
    others: match.breakdown_others,
    overtime: match.breakdown_overtime,
    paymentCurrency: match.breakdown_payment_currency as Currency,
    paymentId: match.breakdown_receipt_id,
    processingFee: match.breakdown_processing_fee,
    proRata: match.breakdown_pro_rata,
    totalPaymentCurrency: match.breakdown_total_payment_currency,
    work: match.breakdown_work,
  };
  return updateParams;
}

export async function getDeelChargeDescription(
  injector: Injector,
  workers?: DeelWorker[],
): Promise<string> {
  const contractIds = (workers?.map(w => w.contract_id).filter(id => !!id) as string[]) ?? [];
  const contracts = await injector
    .get(DeelContractsProvider)
    .getEmployeeByContractIdLoader.loadMany(contractIds)
    .then(
      contract =>
        contract.filter(
          id => !!id && !(id instanceof Error),
        ) as IGetEmployeeIDsByContractIdsResult[],
    );
  const workerNames = contracts.map(c => c.contractor_name.split(' ')[0]);
  const workersDescription = workerNames?.length ? ` for ${workerNames.join(', ')}` : '';
  const description = `Deel payment${workersDescription}`;
  return description;
}
