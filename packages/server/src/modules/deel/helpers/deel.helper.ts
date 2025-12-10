import { endOfDay, startOfDay } from 'date-fns';
import type { Injector } from 'graphql-modules';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { dateToTimelessDateString, hashStringToInt } from '../../../shared/helpers/index.js';
import type { LedgerProto, StrictLedgerProto } from '../../../shared/types/index.js';
import { DeelClientProvider } from '../../app-providers/deel/deel-client.provider.js';
import type {
  DeelWorker,
  Invoice,
  PaymentBreakdownRecord,
  PaymentReceipts,
} from '../../app-providers/deel/schemas.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { uploadToCloudinary } from '../../documents/helpers/upload.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import type {
  IGetDocumentsByChargeIdResult,
  IInsertDocumentsParams,
} from '../../documents/types.js';
import { TaxCategoriesProvider } from '../../financial-entities/providers/tax-categories.provider.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
import type {
  IGetEmployeeIDsByContractIdsResult,
  IInsertDeelInvoiceRecordsParams,
} from '../types.js';

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
  chargeId: string,
  match: DeelInvoiceMatch,
  injector: Injector,
  ownerId: string,
): Promise<string> {
  try {
    // fetch file from Deel
    const file = await injector.get(DeelClientProvider).getSalaryInvoiceFile(match.id);

    const fileHashPromise = file.text().then(content => hashStringToInt(content).toString());

    // upload file to cloudinary
    const fileUrlsPromise = uploadToCloudinary(injector, file);

    const [{ fileUrl, imageUrl }, fileHash] = await Promise.all([fileUrlsPromise, fileHashPromise]);

    // create the new document object
    const newDocumentFromInvoice: IInsertDocumentsParams['document'][number] = {
      image: imageUrl ?? null,
      file: fileUrl ?? null,
      documentType:
        match.breakdown_contract_type === 'prepaid_billing'
          ? DocumentType.Other
          : DocumentType.Invoice,
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
      exchangeRateOverride: null,
      fileHash,
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
    const message = 'Error uploading Deel invoice';
    console.error(`${message}: ${error}`);
    throw new Error(message);
  }
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
    dueDate: match.due_date,
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

export async function fetchAndFilterInvoices(injector: Injector) {
  try {
    const invoices = await injector.get(DeelClientProvider).getSalaryInvoices(); // TODO: enable setting up period

    const filteredInvoices: Invoice[] = [];

    await Promise.all(
      invoices.data.map(async invoice => {
        const dbInvoice = await injector
          .get(DeelInvoicesProvider)
          .getInvoicesByIdLoader.load(invoice.id)
          .catch(e => {
            const message = 'Error fetching invoice by ID';
            console.error(`${message}: ${e}`);
            throw new Error(message);
          });
        if (!dbInvoice) {
          filteredInvoices.push(invoice);
        }
      }),
    );

    return { invoices: filteredInvoices };
  } catch (error) {
    const message = 'Error fetching Deel invoices';
    console.error(`${message}: ${error}`);
    throw new Error(message);
  }
}

export async function fetchReceipts(injector: Injector) {
  try {
    const res = await injector.get(DeelClientProvider).getPaymentReceipts(); // TODO: use PERION_IN_MONTHS
    return res.data.rows;
  } catch (error) {
    const message = 'Error fetching Deel receipts';
    console.error(`${message}: ${error}`);
    throw new Error(message);
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

type ContractInfo = {
  contract_country: string;
  contract_start_date: string;
  contract_type: string;
  contractor_email: string;
  contractor_employee_name: string;
  contractor_unique_identifier: string;
};

export function getContractsFromPaymentBreakdowns(matches: DeelInvoiceMatch[]) {
  const contractsMap = new Map<string, ContractInfo>();
  for (const match of matches) {
    if (!match.contract_id) {
      continue;
    }
    const existing = contractsMap.get(match.contract_id);
    if (existing) {
      // verify consistency
      if (
        existing.contract_country !== match.breakdown_contract_country ||
        existing.contract_start_date !== match.breakdown_contract_start_date ||
        existing.contract_type !== match.breakdown_contract_type ||
        existing.contractor_email !== match.breakdown_contractor_email ||
        existing.contractor_employee_name !== match.breakdown_contractor_employee_name ||
        existing.contractor_unique_identifier !== match.breakdown_contractor_unique_identifier
      ) {
        throw new Error(`Inconsistent contract info for contract_id [${match.contract_id}]`);
      }
    } else {
      contractsMap.set(match.contract_id, {
        contract_country: match.breakdown_contract_country,
        contract_start_date: match.breakdown_contract_start_date,
        contract_type: match.breakdown_contract_type,
        contractor_email: match.breakdown_contractor_email,
        contractor_employee_name: match.breakdown_contractor_employee_name,
        contractor_unique_identifier: match.breakdown_contractor_unique_identifier,
      });
    }
  }
  return contractsMap;
}

export async function validateContracts(
  contractsInfo: Map<string, ContractInfo>,
  injector: Injector,
) {
  await Promise.all(
    Array.from(contractsInfo.keys()).map(async contractId => {
      try {
        const deelEmployee = await injector
          .get(DeelContractsProvider)
          .getEmployeeByContractIdLoader.load(contractId);
        if (!deelEmployee) {
          throw new Error(`Deel contract ID [${contractId}] not found in DB`);
        }
      } catch {
        try {
          const contractInfo = contractsInfo.get(contractId)!;
          await injector.get(DeelContractsProvider).insertDeelContract({
            contractId,
            contractorId: contractInfo.contractor_unique_identifier,
            contractorName: contractInfo.contractor_employee_name,
            contractStartDate: contractInfo.contract_start_date,
            businessId: DEEL_BUSINESS_ID, // TODO: replace with DB based business id
          });
        } catch (error) {
          const message = `Error adding Deel contract [${contractId}] during validation`;
          console.error(message, error);
          throw new Error(message);
        }
      }
    }),
  );
}

export async function getChargeMatchesForPayments(
  injector: Injector,
  ownerId: string,
  receipts: PaymentReceipts[],
) {
  const receiptChargeMap = await injector.get(DeelInvoicesProvider).getReceiptToCharge();
  const invoiceChargeMap = new Map<string, string>();

  const newReceipts: PaymentReceipts[] = [];
  receipts.map(receipt => {
    const chargeId = receiptChargeMap.get(receipt.id);
    if (chargeId) {
      receipt.invoices?.map(invoiceId => invoiceChargeMap.set(invoiceId.id, chargeId));
    } else {
      newReceipts.push(receipt);
    }
  });

  await Promise.all(
    newReceipts.map(async receipt => {
      const description = await getDeelChargeDescription(injector, receipt.workers);
      const charge = await injector.get(ChargesProvider).generateCharge({
        ownerId,
        userDescription: description,
      });

      receiptChargeMap.set(receipt.id, charge.id);

      // TODO: upload receipt file (currently not available from Deel API)
    }),
  );

  return { receiptChargeMap, invoiceChargeMap };
}

export function matchInvoicesWithPayments(
  invoices: Invoice[],
  paymentBreakdowns: PaymentBreakdownRecord[],
) {
  const matches: DeelInvoiceMatch[] = [];
  const unmatched: Invoice[] = [];

  invoices.map(invoice => {
    if (invoice.status === 'processed' || invoice.total === '0.00') {
      unmatched.push(invoice);
      return;
    }

    const optionalMatches = paymentBreakdowns.filter(receipt => invoice.id === receipt.invoice_id);
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

  return { matches, unmatched };
}
