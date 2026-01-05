import { GraphQLError } from 'graphql';
import { deleteCharges } from '../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { IGetChargesByIdsResult } from '../../charges/types.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import {
  createDeelInvoiceMatchFromUnmatchedInvoice,
  fetchAndFilterInvoices,
  fetchReceipts,
  getChargeMatchesForPayments,
  getContractsFromPaymentBreakdowns,
  getDeelChargeDescription,
  insertDeelInvoiceRecord,
  matchInvoicesWithPayments,
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
    fetchDeelDocuments: async (_, __, context) => {
      const { injector, adminContext } = context;
      try {
        const invoices = await fetchAndFilterInvoices(injector);
        if (invoices.length === 0) {
          return [];
        }

        const receipts = await fetchReceipts(injector);

        const { matches, unmatched } = await matchInvoicesWithPayments(
          injector,
          invoices,
          receipts,
        );

        if (matches.length + unmatched.length <= 0) {
          return [];
        }

        // fetch contacts and validate
        const contractsInfo = getContractsFromPaymentBreakdowns(matches);
        await validateContracts(contractsInfo, injector);

        const { receiptChargeMap, invoiceChargeMap, newReceipts } =
          await getChargeMatchesForPayments(injector, receipts);

        const updatedChargeIdsSet = new Set<string>();

        // insert/update unmatched Deel invoice records
        for (const invoice of unmatched) {
          if (invoiceChargeMap.has(invoice.id)) {
            console.log('Found missing match for invoice via invoiceChargeMap:', invoice.id);
          }

          const charge = await injector.get(ChargesProvider).generateCharge({
            ownerId: adminContext.defaultAdminBusinessId,
            userDescription: `Deel invoice ${invoice.label}`,
          });

          updatedChargeIdsSet.add(charge.id);

          const match = createDeelInvoiceMatchFromUnmatchedInvoice(invoice);

          await insertDeelInvoiceRecord(context, match, charge.id);
        }

        // insert/update matched Deel invoice records
        for (const match of matches) {
          let chargeId =
            invoiceChargeMap.get(match.id) ?? receiptChargeMap.get(match.breakdown_receipt_id);

          // if no charge found, create one from receipt
          if (!chargeId) {
            const receipt = newReceipts.find(r => r.id === match.breakdown_receipt_id);
            if (receipt) {
              const description = await getDeelChargeDescription(injector, receipt.workers);
              const charge = await injector.get(ChargesProvider).generateCharge({
                ownerId: adminContext.defaultAdminBusinessId,
                userDescription: description,
              });
              chargeId = charge.id;

              // TODO: upload receipt file (currently not available from Deel API)
            }
          }

          if (!chargeId) {
            throw new Error('Charge not found for invoice');
          }

          updatedChargeIdsSet.add(chargeId);

          await insertDeelInvoiceRecord(context, match, chargeId);
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
