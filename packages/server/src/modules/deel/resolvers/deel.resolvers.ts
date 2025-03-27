import { GraphQLError } from 'graphql';
import {
  convertMatchToDeelInvoiceRecord,
  fetchAndFilterInvoices,
  fetchPaymentBreakdowns,
  fetchReceipts,
  getChargeMatchesForPayments,
  matchInvoicesWithPayments,
  uploadDeelInvoice,
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
        const { invoices, knownReceiptIds } = await fetchAndFilterInvoices(injector);

        const receipts = await fetchReceipts(injector);

        const paymentBreakdowns = await fetchPaymentBreakdowns(injector, receipts);

        const paymentToChargeMap = await getChargeMatchesForPayments(
          injector,
          adminContext.defaultAdminBusinessId,
          receipts,
          knownReceiptIds,
        );

        const matches = matchInvoicesWithPayments(invoices, paymentBreakdowns);

        for (const match of matches) {
          const documentId = await uploadDeelInvoice(
            paymentToChargeMap,
            match,
            injector,
            adminContext.defaultAdminBusinessId,
          );

          await injector
            .get(DeelInvoicesProvider)
            .insertDeelInvoiceRecords(convertMatchToDeelInvoiceRecord(match, documentId))
            .catch(error => {
              console.error(error);
              throw new Error('Error uploading Deel invoice record');
            });
        }

        // TODO: return updated charges
        return true;
      } catch (error) {
        const message = 'Error fetching Deel documents';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
};
