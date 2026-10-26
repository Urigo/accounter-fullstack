import type {
  DeelWorker,
  Invoice,
  PaymentBreakdownRecord,
  PaymentReceipts,
} from '../../app-providers/deel/schemas.js';
import type { DeelSyncIssue } from './deel-sync-errors.js';
import {
  createDeelInvoiceMatchFromUnmatchedInvoice,
  type DeelInvoiceMatch,
  type PrefixedBreakdown,
} from './deel.helper.js';

export type DecoratedPaymentBreakdown = PaymentBreakdownRecord & { receipt_id: string };

/** The stored state of a Deel invoice that already has a `deel_invoices` row */
export type StoredDeelInvoice = {
  id: string;
  payment_id: string | null;
  document_id: string | null;
};

/** What Deel tells about a contract that is not linked to a business yet */
export type UnknownContractDetails = {
  workerId?: string | null;
  workerName?: string | null;
  startDate?: string | null;
  /** Why the details could not be fetched, if they could not */
  error?: string;
};

/** All invoices of one Deel payment receipt that are saved together, under the receipt's charge */
export type ReceiptSyncUnit = {
  kind: 'receipt';
  receiptId: string;
  /** The charge already holding the receipt's documents; a new one is generated when null */
  existingChargeId: string | null;
  workers: DeelWorker[] | undefined;
  /** Invoices with no `deel_invoices` row yet */
  inserts: DeelInvoiceMatch[];
  /** Invoices saved earlier without a payment, now matched to this receipt */
  updates: DeelInvoiceMatch[];
};

/** A new invoice no payment matches yet, saved on its own */
export type StandaloneSyncUnit = {
  kind: 'standalone';
  invoice: DeelInvoiceMatch;
  existingChargeId: string | null;
};

export type DeelSyncUnit = ReceiptSyncUnit | StandaloneSyncUnit;

export type DeelSyncPlanInput = {
  /** Invoices from Deel that are new or still unmatched — see {@link splitPendingInvoices} */
  pending: PendingInvoices;
  knownContractIds: ReadonlySet<string>;
  unknownContracts: ReadonlyMap<string, UnknownContractDetails>;
  receipts: PaymentReceipts[];
  breakdowns: DecoratedPaymentBreakdown[];
  /** Receipt (payment) id → the charge already holding its documents */
  receiptChargeMap: ReadonlyMap<string, string>;
};

export type DeelSyncPlan = {
  units: DeelSyncUnit[];
  issues: DeelSyncIssue[];
};

export type PendingInvoices = {
  /** Invoices with no `deel_invoices` row */
  newInvoices: Invoice[];
  /** Invoices saved earlier with no payment */
  unmatchedExistingInvoices: Invoice[];
};

/** Split Deel's invoices into the ones this sync may write: new ones and stored-but-unmatched ones */
export function splitPendingInvoices(
  invoices: readonly Invoice[],
  storedInvoices: ReadonlyMap<string, StoredDeelInvoice>,
): PendingInvoices {
  const newInvoices: Invoice[] = [];
  const unmatchedExistingInvoices: Invoice[] = [];
  for (const invoice of invoices) {
    const stored = storedInvoices.get(invoice.id);
    if (!stored) {
      newInvoices.push(invoice);
    } else if (!stored.payment_id) {
      unmatchedExistingInvoices.push(invoice);
    }
  }
  return { newInvoices, unmatchedExistingInvoices };
}

export function groupBreakdownsByInvoice(
  breakdowns: readonly DecoratedPaymentBreakdown[],
): Map<string, DecoratedPaymentBreakdown[]> {
  const byInvoice = new Map<string, DecoratedPaymentBreakdown[]>();
  for (const breakdown of breakdowns) {
    const list = byInvoice.get(breakdown.invoice_id) ?? [];
    list.push(breakdown);
    byInvoice.set(breakdown.invoice_id, list);
  }
  return byInvoice;
}

/**
 * How an invoice relates to the payment breakdowns that mention it: one breakdown is a match;
 * none — or several, for a processed, refunded or zero invoice — leaves it unmatched; several
 * otherwise can't be resolved.
 */
function classifyMatch(
  invoice: Invoice,
  candidates: readonly DecoratedPaymentBreakdown[],
): 'match' | 'unmatched' | 'ambiguous' {
  if (candidates.length === 0) {
    return 'unmatched';
  }
  if (candidates.length === 1) {
    return 'match';
  }
  if (invoice.status === 'processed' || invoice.total === '0.00' || invoice.status === 'refunded') {
    return 'unmatched';
  }
  return 'ambiguous';
}

/**
 * The pending invoices this sync may write: every new invoice, and the stored unmatched ones that
 * now relate to a payment. A stored invoice that stays unmatched is left alone, so it is neither
 * checked nor reported.
 */
export function getInvoicesToWrite(
  pending: PendingInvoices,
  breakdownsByInvoice: ReadonlyMap<string, readonly DecoratedPaymentBreakdown[]>,
): Invoice[] {
  return [
    ...pending.newInvoices,
    ...pending.unmatchedExistingInvoices.filter(
      invoice => classifyMatch(invoice, breakdownsByInvoice.get(invoice.id) ?? []) !== 'unmatched',
    ),
  ];
}

function toMatch(invoice: Invoice, breakdown: DecoratedPaymentBreakdown): DeelInvoiceMatch {
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(breakdown)) {
    prefixed[`breakdown_${key}`] = value;
  }
  return { ...(prefixed as PrefixedBreakdown), ...invoice };
}

type ContractInfo = {
  contract_country: string;
  contract_start_date: string;
  contract_type: string;
  contractor_email: string;
  contractor_employee_name: string;
  contractor_unique_identifier: string;
};

function contractInfoOf(match: DeelInvoiceMatch): ContractInfo {
  return {
    contract_country: match.breakdown_contract_country,
    contract_start_date: match.breakdown_contract_start_date,
    contract_type: match.breakdown_contract_type,
    contractor_email: match.breakdown_contractor_email,
    contractor_employee_name: match.breakdown_contractor_employee_name,
    contractor_unique_identifier: match.breakdown_contractor_unique_identifier,
  };
}

function describeContract(contractId: string, details: UnknownContractDetails | undefined): string {
  if (!details || details.error) {
    const reason = details?.error
      ? ` (its details could not be fetched from Deel: ${details.error})`
      : '';
    return `Deel contract [${contractId}]${reason}`;
  }
  const parts = [
    details.workerName ? `worker ${details.workerName}` : null,
    details.workerId ? `worker id ${details.workerId}` : null,
    details.startDate ? `start date ${details.startDate}` : null,
  ].filter(Boolean);
  return `Deel contract [${contractId}]${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

function listIds(ids: readonly string[]): string {
  return ids.join(', ');
}

/**
 * Turn what Deel and the DB report into units of work, each saved all-or-nothing. No I/O.
 *
 * A pending invoice that cannot be saved — its contract is unknown or inconsistent, or it matches
 * several payments — becomes an issue, and so does every unit it belongs to: a receipt is saved
 * only with all of its pending invoices, never in part.
 */
export function buildDeelSyncPlan(input: DeelSyncPlanInput): DeelSyncPlan {
  const { pending, knownContractIds, unknownContracts, receipts, breakdowns, receiptChargeMap } =
    input;
  const issues: DeelSyncIssue[] = [];
  /** Invoice id → the issue that keeps it from being saved */
  const blockingIssues = new Map<string, DeelSyncIssue>();
  const block = (issue: DeelSyncIssue) => {
    issues.push(issue);
    for (const invoiceId of issue.invoiceIds) {
      if (!blockingIssues.has(invoiceId)) {
        blockingIssues.set(invoiceId, issue);
      }
    }
  };

  const unmatchedExistingIds = new Set(pending.unmatchedExistingInvoices.map(i => i.id));
  const breakdownsByInvoice = groupBreakdownsByInvoice(breakdowns);
  const invoicesToWrite = getInvoicesToWrite(pending, breakdownsByInvoice);

  // contracts must be linked to a business before their invoices can be booked
  const invoicesByUnknownContract = new Map<string, string[]>();
  for (const invoice of invoicesToWrite) {
    if (invoice.contract_id && !knownContractIds.has(invoice.contract_id)) {
      const ids = invoicesByUnknownContract.get(invoice.contract_id) ?? [];
      ids.push(invoice.id);
      invoicesByUnknownContract.set(invoice.contract_id, ids);
    }
  }
  for (const [contractId, invoiceIds] of invoicesByUnknownContract) {
    block({
      code: 'UNKNOWN_CONTRACT',
      message: `${describeContract(contractId, unknownContracts.get(contractId))} is not linked to a business. Add it with "addDeelContract", then re-run. Invoices: ${listIds(invoiceIds)}`,
      invoiceIds,
      contractId,
    });
  }

  // match the invoices to write with payment breakdowns
  const matches: DeelInvoiceMatch[] = [];
  const unmatched: Invoice[] = [];
  for (const invoice of invoicesToWrite) {
    const candidates = breakdownsByInvoice.get(invoice.id) ?? [];
    const kind = classifyMatch(invoice, candidates);
    if (kind === 'unmatched') {
      unmatched.push(invoice);
    } else if (kind === 'match') {
      matches.push(toMatch(invoice, candidates[0]));
    } else {
      block({
        code: 'AMBIGUOUS_PAYMENT_MATCH',
        message: `Deel invoice ${invoice.label} [${invoice.id}] matches ${candidates.length} payment breakdowns (receipts ${listIds([...new Set(candidates.map(c => c.receipt_id))])}), so it can't be assigned to one payment`,
        invoiceIds: [invoice.id],
      });
    }
  }

  // breakdown rows of the same contract must agree on the contractor
  const contractInfos = new Map<string, ContractInfo>();
  const inconsistentContracts = new Set<string>();
  const matchIdsByContract = new Map<string, string[]>();
  for (const match of matches) {
    if (!match.contract_id) {
      continue;
    }
    const contractMatchIds = matchIdsByContract.get(match.contract_id) ?? [];
    contractMatchIds.push(match.id);
    matchIdsByContract.set(match.contract_id, contractMatchIds);
    const existing = contractInfos.get(match.contract_id);
    if (!existing) {
      contractInfos.set(match.contract_id, contractInfoOf(match));
      continue;
    }
    if (match.breakdown_contractor_unique_identifier === '') {
      // fee invoices carry alternative contractor info
      continue;
    }
    const info = contractInfoOf(match);
    const differing = (Object.keys(info) as Array<keyof ContractInfo>).filter(
      key => info[key] !== existing[key],
    );
    if (differing.length) {
      inconsistentContracts.add(match.contract_id);
    }
  }
  for (const contractId of inconsistentContracts) {
    const invoiceIds = matchIdsByContract.get(contractId) ?? [];
    block({
      code: 'INCONSISTENT_CONTRACT_INFO',
      message: `Deel payment breakdowns of contract [${contractId}] disagree on the contractor details (country, start date, type, email, name or id). Invoices: ${listIds(invoiceIds)}`,
      invoiceIds,
      contractId,
    });
  }

  // charges already holding a receipt's documents, by receipt and by invoice
  const invoiceChargeMap = new Map<string, string>();
  for (const receipt of receipts) {
    const chargeId = receiptChargeMap.get(receipt.id);
    if (chargeId) {
      for (const invoice of receipt.invoices ?? []) {
        invoiceChargeMap.set(invoice.id, chargeId);
      }
    }
  }
  for (const breakdown of breakdowns) {
    const chargeId = receiptChargeMap.get(breakdown.receipt_id);
    if (chargeId) {
      invoiceChargeMap.set(breakdown.invoice_id, chargeId);
    }
  }

  const units: DeelSyncUnit[] = [];

  // one unit per receipt, in the order Deel lists the receipts
  const matchesByReceipt = new Map<string, DeelInvoiceMatch[]>();
  for (const match of matches) {
    const list = matchesByReceipt.get(match.breakdown_receipt_id) ?? [];
    list.push(match);
    matchesByReceipt.set(match.breakdown_receipt_id, list);
  }
  const receiptsById = new Map(receipts.map(receipt => [receipt.id, receipt]));
  const invoiceIdsByReceipt = new Map<string, string[]>();
  for (const breakdown of breakdowns) {
    const list = invoiceIdsByReceipt.get(breakdown.receipt_id) ?? [];
    list.push(breakdown.invoice_id);
    invoiceIdsByReceipt.set(breakdown.receipt_id, list);
  }
  const receiptOrder = new Map(receipts.map((receipt, index) => [receipt.id, index]));
  const receiptIds = [...matchesByReceipt.keys()].sort(
    (a, b) =>
      (receiptOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (receiptOrder.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b),
  );

  for (const receiptId of receiptIds) {
    const receiptMatches = matchesByReceipt.get(receiptId)!;
    const invoiceIds = receiptMatches.map(match => match.id);
    const receipt = receiptsById.get(receiptId);
    const description = `Deel receipt [${receiptId}] (invoices ${listIds(invoiceIds)})`;

    // every pending invoice the receipt covers must be savable for the receipt to be saved
    const coveredInvoiceIds = new Set([
      ...invoiceIds,
      ...(receipt?.invoices ?? []).map(invoice => invoice.id),
      ...(invoiceIdsByReceipt.get(receiptId) ?? []),
    ]);
    const blocker = [...coveredInvoiceIds]
      .map(id => blockingIssues.get(id))
      .find(issue => issue !== undefined);
    if (blocker) {
      const ownInvoiceIds = invoiceIds.filter(id => !blocker.invoiceIds.includes(id));
      if (ownInvoiceIds.length) {
        issues.push({
          code: blocker.code,
          message: `${description} was not synced, since it also covers invoice(s) ${listIds(blocker.invoiceIds)} that can't be synced: ${blocker.message}`,
          invoiceIds: ownInvoiceIds,
          receiptId,
          contractId: blocker.contractId ?? null,
        });
      }
      continue;
    }

    // breakdowns are only fetched for listed receipts, so a receipt without a charge can always
    // get a new one
    const existingChargeId =
      receiptChargeMap.get(receiptId) ??
      invoiceIds.map(id => invoiceChargeMap.get(id)).find(id => !!id) ??
      null;

    units.push({
      kind: 'receipt',
      receiptId,
      existingChargeId,
      workers: receipt?.workers,
      inserts: receiptMatches.filter(match => !unmatchedExistingIds.has(match.id)),
      updates: receiptMatches.filter(match => unmatchedExistingIds.has(match.id)),
    });
  }

  // new invoices no payment matches are saved on their own; stored unmatched ones stay as they are
  const standalone = unmatched
    .filter(invoice => !unmatchedExistingIds.has(invoice.id) && !blockingIssues.has(invoice.id))
    .sort(
      (a, b) =>
        new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime() ||
        a.id.localeCompare(b.id),
    );
  for (const invoice of standalone) {
    units.push({
      kind: 'standalone',
      invoice: createDeelInvoiceMatchFromUnmatchedInvoice(invoice),
      existingChargeId: invoiceChargeMap.get(invoice.id) ?? null,
    });
  }

  return { units, issues };
}

/** Invoice ids a unit writes */
export function getUnitInvoiceIds(unit: DeelSyncUnit): string[] {
  return unit.kind === 'receipt'
    ? [...unit.inserts, ...unit.updates].map(match => match.id)
    : [unit.invoice.id];
}

/** A human-readable name of a unit, for messages */
export function describeUnit(unit: DeelSyncUnit): string {
  return unit.kind === 'receipt'
    ? `Deel receipt [${unit.receiptId}] (invoices ${listIds(getUnitInvoiceIds(unit))})`
    : `Deel invoice ${unit.invoice.label} [${unit.invoice.id}]`;
}
