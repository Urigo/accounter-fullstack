import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { DeelClientProvider } from '../../app-providers/deel/deel-client.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
import { describeError, type DeelSyncIssue } from './deel-sync-errors.js';
import { syncUnit } from './deel-sync-execute.helper.js';
import {
  buildDeelSyncPlan,
  splitPendingInvoices,
  type DecoratedPaymentBreakdown,
  type DeelSyncPlanInput,
  type StoredDeelInvoice,
  type UnknownContractDetails,
} from './deel-sync-plan.helper.js';
import { requireDeelBusinessId } from './deel.helper.js';

export type DeelSyncResult = {
  charges: IGetChargesByIdsResult[];
  issues: DeelSyncIssue[];
};

/** Run a read step, naming it in the error if it fails */
async function step<T>(description: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`${description} failed`, { cause: error });
  }
}

/**
 * Read everything the sync decides on. No writes; any failure here stops the sync before anything
 * is saved. Returns null when no invoice is pending.
 */
export async function collectDeelSyncInput(injector: Injector): Promise<DeelSyncPlanInput | null> {
  const deelClient = injector.get(DeelClientProvider);

  const invoices = await deelClient.getSalaryInvoices();

  const storedInvoices = await step('Reading the stored Deel invoices', async () => {
    const rows = await injector
      .get(DeelInvoicesProvider)
      .getInvoicesByIdLoader.loadMany(invoices.map(invoice => invoice.id));
    const stored = new Map<string, StoredDeelInvoice>();
    for (const row of rows) {
      if (row instanceof Error) {
        throw row;
      }
      if (row) {
        stored.set(row.id, row);
      }
    }
    return stored;
  });

  const pending = splitPendingInvoices(invoices, storedInvoices);
  if (pending.newInvoices.length === 0 && pending.unmatchedExistingInvoices.length === 0) {
    return null;
  }

  const pendingContractIds = [
    ...new Set(
      [...pending.newInvoices, ...pending.unmatchedExistingInvoices]
        .map(invoice => invoice.contract_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const knownContractIds = await step('Reading the linked Deel contracts', async () => {
    const contracts = await injector
      .get(DeelContractsProvider)
      .getEmployeeByContractIdLoader.loadMany(pendingContractIds);
    const known = new Set<string>();
    for (const contract of contracts) {
      if (contract instanceof Error) {
        throw contract;
      }
      if (contract) {
        known.add(contract.contract_id);
      }
    }
    return known;
  });

  // details help the user link the contract; sequential, to stay clear of Deel's rate limits
  const unknownContracts = new Map<string, UnknownContractDetails>();
  for (const contractId of pendingContractIds.filter(id => !knownContractIds.has(id))) {
    try {
      const { data } = await deelClient.getContractDetails(contractId);
      unknownContracts.set(contractId, {
        workerId: data.worker?.id ?? null,
        workerName: data.worker?.full_name ?? null,
        startDate: data.start_date ?? null,
      });
    } catch (error) {
      unknownContracts.set(contractId, { error: describeError(error) });
    }
  }

  // sequential, to stay clear of Deel's rate limits
  const receipts = await deelClient.getPaymentReceipts();
  const breakdowns: DecoratedPaymentBreakdown[] = [];
  for (const receipt of receipts) {
    if (receipt.id) {
      const breakdown = await deelClient.getPaymentBreakdown(receipt.id);
      breakdowns.push(...breakdown.data.map(row => ({ ...row, receipt_id: receipt.id })));
    }
  }

  const receiptChargeMap = await injector.get(DeelInvoicesProvider).getReceiptToCharge();

  return { pending, knownContractIds, unknownContracts, receipts, breakdowns, receiptChargeMap };
}

/**
 * Pull Deel invoices into charges and documents. Each receipt (or unmatched invoice) is saved in
 * its own transaction, all-or-nothing; the ones that could not be saved are reported as issues.
 * Throws when the sync cannot start or read its input — nothing is saved then.
 */
export async function syncDeelDocuments(injector: Injector): Promise<DeelSyncResult> {
  const deelBusinessId = await requireDeelBusinessId(injector);
  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  const input = await collectDeelSyncInput(injector);
  if (!input) {
    return { charges: [], issues: [] };
  }

  const { units, issues } = buildDeelSyncPlan(input);

  const chargeIds: string[] = [];
  for (const unit of units) {
    const outcome = await syncUnit(injector, unit, { ownerId, deelBusinessId });
    if (outcome.ok) {
      if (!chargeIds.includes(outcome.chargeId)) {
        chargeIds.push(outcome.chargeId);
      }
      issues.push(...outcome.warnings);
    } else {
      issues.push(outcome.issue);
    }
  }

  const chargesProvider = injector.get(ChargesProvider);
  for (const chargeId of chargeIds) {
    await chargesProvider.invalidateCharge(chargeId);
  }
  const charges = await chargesProvider.getChargeByIdLoader.loadMany(chargeIds);

  return {
    charges: charges.filter(
      (charge): charge is IGetChargesByIdsResult => !!charge && !(charge instanceof Error),
    ),
    issues,
  };
}
