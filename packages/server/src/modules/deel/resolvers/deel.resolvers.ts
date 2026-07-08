import { GraphQLError } from 'graphql';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { deleteCharges } from '../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { IGetChargesByIdsResult } from '../../charges/types.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
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
} from '../helpers/deel.helper.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import type { DeelModule } from '../types.js';

export const deelResolvers: DeelModule.Resolvers = {
  Mutation: {
    addDeelContract: async (
      _,
      { contractId, contractorId, contractorName, contractStartDate, businessId },
      { injector },
    ) => {
      try {
        await injector.get(DeelContractsProvider).insertDeelContract({
          contractId,
          contractorId,
          contractorName,
          contractStartDate,
          businessId,
        });
        return true;
      } catch (error) {
        const message = `Error adding Deel contract [${contractId}]`;
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    fetchDeelDocuments: async (_, __, { injector }) => {
      try {
        const { newInvoices, unmatchedExistingInvoices } = await fetchAndFilterInvoices(injector);
        if (newInvoices.length === 0 && unmatchedExistingInvoices.length === 0) {
          // nothing to fetch or reconcile — skip the Deel API calls below
          return [];
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
          return [];
        }

        // fetch contacts and validate
        const contractsInfo = getContractsFromPaymentBreakdowns(matches);
        await validateContracts(contractsInfo, injector);

        const { receiptChargeMap, invoiceChargeMap, newReceipts } =
          await getChargeMatchesForPayments(injector, receipts, paymentBreakdowns);

        const updatedChargeIdsSet = new Set<string>();

        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

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
          }

          // track the charge regardless of whether it was reused or freshly generated, so it is
          // included in the returned charges and the empty-charge cleanup below
          updatedChargeIdsSet.add(chargeId);

          const match = createDeelInvoiceMatchFromUnmatchedInvoice(invoice);
          await insertDeelInvoiceRecord(injector, match, chargeId);
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
              receiptChargeMap.set(match.breakdown_receipt_id, chargeId);

              // TODO: upload receipt file (currently not available from Deel API)
            }
          }

          if (!chargeId) {
            throw new Error('Charge not found for invoice');
          }

          updatedChargeIdsSet.add(chargeId);

          if (unmatchedExistingInvoicesSet.has(match.id)) {
            // update existing invoice record
            await updateDeelInvoiceRecord(injector, match, chargeId);
          } else {
            // insert new invoice record
            await insertDeelInvoiceRecord(injector, match, chargeId);
          }
        }

        // fetch charges, clean empty ones
        const charges: IGetChargesByIdsResult[] = [];
        await Promise.all(
          Array.from(updatedChargeIdsSet).map(async chargeId => {
            const [charge, transactions, documents] = await Promise.all([
              injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId),
              injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(chargeId),
              injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(chargeId),
            ]);
            if (!charge) {
              return;
            }
            if (documents.length === 0 && transactions.length === 0) {
              await deleteCharges([charge.id], injector);
            } else {
              charges.push(charge);
            }
          }),
        );
        return charges;
      } catch (error) {
        const message = 'Error fetching Deel documents';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
};
