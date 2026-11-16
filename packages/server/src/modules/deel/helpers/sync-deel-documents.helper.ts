import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { deleteChargesIfEmpty } from '../../charges/helpers/delete-empty-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import {
  createDeelInvoiceMatchFromUnmatchedInvoice,
  fetchAndFilterInvoices,
  fetchPaymentBreakdowns,
  fetchReceipts,
  getChargeMatchesForPayments,
  getContractsFromPaymentBreakdowns,
  getDeelChargeDescription,
  insertDeelInvoiceRecord,
  matchInvoicesWithPayments,
  updateDeelInvoiceRecord,
  validateContracts,
} from './deel.helper.js';

/** A charge that got Deel invoice records in a sync run. */
export type SyncedDeelCharge = {
  charge: IGetChargesByIdsResult;
  /** True when the charge was created by this run, false when an existing charge was reused */
  isNew: boolean;
  /** Number of Deel invoice records inserted or updated for the charge in this run */
  invoiceCount: number;
};

/**
 * Pulls new Deel invoices and payments, records them, and attaches them to charges (creating
 * charges where needed). Charges that end up empty are deleted. Returns the remaining charges.
 *
 * Runs for the admin context's owner: new charges take it from the same place as the invoice
 * records, documents and contracts the Deel helpers write.
 */
export async function syncDeelDocuments(
  injector: Injector,
): Promise<{ charges: SyncedDeelCharge[] }> {
  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const { newInvoices, unmatchedExistingInvoices } = await fetchAndFilterInvoices(injector);
  if (newInvoices.length === 0 && unmatchedExistingInvoices.length === 0) {
    // nothing to fetch or reconcile — skip the Deel API calls below
    return { charges: [] };
  }

  const unmatchedExistingInvoicesSet = new Set(unmatchedExistingInvoices.map(i => i.id));

  // NOTE: avoiding fetching receipts and invoices in parallel to avoid hitting Deel API rate limits
  const receipts = await fetchReceipts(injector);
  const paymentBreakdowns = await fetchPaymentBreakdowns(injector, receipts);

  const { matches, unmatched } = await matchInvoicesWithPayments(
    [...newInvoices, ...unmatchedExistingInvoices],
    paymentBreakdowns,
  );

  if (matches.length + unmatched.length <= 0) {
    return { charges: [] };
  }

  // fetch contacts and validate
  const contractsInfo = getContractsFromPaymentBreakdowns(matches);
  await validateContracts(contractsInfo, injector);

  const { receiptChargeMap, invoiceChargeMap, newReceipts } = await getChargeMatchesForPayments(
    injector,
    receipts,
    paymentBreakdowns,
  );

  // charge ID → number of invoice records written to it. Insertion order is the returned order
  const invoiceCountByChargeId = new Map<string, number>();
  const createdChargeIds = new Set<string>();
  const countInvoice = (chargeId: string) =>
    invoiceCountByChargeId.set(chargeId, (invoiceCountByChargeId.get(chargeId) ?? 0) + 1);

  // insert unmatched Deel invoice records
  for (const invoice of unmatched) {
    // an already-recorded invoice that is still unmatched has nothing new to persist — skip
    // it before generating a charge, which would otherwise be created and immediately cleaned
    // up as empty
    if (unmatchedExistingInvoicesSet.has(invoice.id)) {
      continue;
    }

    let chargeId = invoiceChargeMap.get(invoice.id);
    if (chargeId) {
      console.log('Found missing match for invoice via invoiceChargeMap:', invoice.id);
    } else {
      const charge = await injector.get(ChargesProvider).generateCharge({
        ownerId,
        userDescription: `Deel invoice ${invoice.label}`,
      });
      chargeId = charge.id;
      createdChargeIds.add(chargeId);
    }

    const match = createDeelInvoiceMatchFromUnmatchedInvoice(invoice);
    await insertDeelInvoiceRecord(injector, match, chargeId);
    countInvoice(chargeId);
  }

  // insert/update matched Deel invoice records
  for (const match of matches) {
    // prefer the receipt-level charge (the breakdown-centric grouping used across this run)
    // and fall back to any invoice-level charge mapping
    let chargeId =
      receiptChargeMap.get(match.breakdown_receipt_id) ?? invoiceChargeMap.get(match.id);

    // if no charge found, create one from receipt
    if (!chargeId) {
      const receipt = newReceipts.find(r => r.id === match.breakdown_receipt_id);
      if (receipt) {
        const description = await getDeelChargeDescription(injector, receipt.workers);
        const charge = await injector.get(ChargesProvider).generateCharge({
          ownerId,
          userDescription: description,
        });
        chargeId = charge.id;
        createdChargeIds.add(chargeId);
        receiptChargeMap.set(match.breakdown_receipt_id, chargeId);

        // TODO: upload receipt file (currently not available from Deel API)
      }
    }

    if (!chargeId) {
      throw new Error('Charge not found for invoice');
    }

    if (unmatchedExistingInvoicesSet.has(match.id)) {
      // update existing invoice record
      await updateDeelInvoiceRecord(injector, match, chargeId);
    } else {
      // insert new invoice record
      await insertDeelInvoiceRecord(injector, match, chargeId);
    }
    countInvoice(chargeId);
  }

  // clean empty charges, fetch the remaining ones
  const updatedChargeIds = Array.from(invoiceCountByChargeId.keys());
  const deletedChargeIds = new Set(await deleteChargesIfEmpty(updatedChargeIds, injector));
  const remainingChargeIds = updatedChargeIds.filter(chargeId => !deletedChargeIds.has(chargeId));
  const charges = await injector
    .get(ChargesProvider)
    .getChargeByIdLoader.loadMany(remainingChargeIds);

  return {
    charges: charges
      .filter((charge): charge is IGetChargesByIdsResult => !!charge && !(charge instanceof Error))
      .map(charge => ({
        charge,
        isNew: createdChargeIds.has(charge.id),
        invoiceCount: invoiceCountByChargeId.get(charge.id) ?? 0,
      })),
  };
}
