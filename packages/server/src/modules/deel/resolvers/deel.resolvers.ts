import { GraphQLError } from 'graphql';
import { deleteCharges } from '@modules/charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  convertMatchToDeelInvoiceRecord,
  fetchAndFilterInvoices,
  fetchPaymentBreakdowns,
  fetchReceipts,
  getChargeMatchesForPayments,
  getContractsFromPaymentBreakdowns,
  matchInvoicesWithPayments,
  uploadDeelInvoice,
  validateContracts,
} from '../helpers/deel.helper.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
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
    fetchDeelDocuments: async (_, __, { injector, adminContext }) => {
      try {
        const { invoices } = await fetchAndFilterInvoices(injector);

        const receipts = await fetchReceipts(injector);

        const paymentBreakdowns = await fetchPaymentBreakdowns(injector, receipts);

        const { matches, unmatched } = matchInvoicesWithPayments(invoices, paymentBreakdowns);

        if (matches.length === 0) {
          return [];
        }

        const contractsInfo = getContractsFromPaymentBreakdowns(matches);
        await validateContracts(contractsInfo, injector);

        const { receiptChargeMap, invoiceChargeMap } = await getChargeMatchesForPayments(
          injector,
          adminContext.defaultAdminBusinessId,
          receipts,
        );

        unmatched.map(invoice => {
          if (invoiceChargeMap.has(invoice.id)) {
            console.log('Found missing match for invoice via invoiceChargeMap:', invoice.id);
          }
        });

        const updatedChargeIdsSet = new Set<string>();
        for (const match of matches) {
          const chargeId =
            invoiceChargeMap.get(match.id) ?? receiptChargeMap.get(match.breakdown_receipt_id);
          if (!chargeId) {
            throw new Error('Charge not found for invoice');
          }

          updatedChargeIdsSet.add(chargeId);

          const documentId = await uploadDeelInvoice(
            chargeId,
            match,
            injector,
            adminContext.defaultAdminBusinessId,
          );

          await injector
            .get(DeelInvoicesProvider)
            .insertDeelInvoiceRecords(convertMatchToDeelInvoiceRecord(match, documentId))
            .catch(error => {
              const message = 'Error uploading Deel invoice record';
              console.error(`${message}: ${error}`);
              if (error instanceof GraphQLError) {
                throw error;
              }
              throw new Error(message);
            });
        }

        if (unmatched.length > 0) {
          console.log('Unmatched payments:', unmatched);
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
