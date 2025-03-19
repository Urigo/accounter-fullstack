import { GraphQLError } from 'graphql';
import { DeelClientProvider } from '@modules/app-providers/deel/deel-client.provider.js';
import type { Invoice, PaymentBreakdownRecord } from '@modules/app-providers/deel/schemas.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import {
  convertMatchToDeelInvoiceRecord,
  getDeelChargeDescription,
  uploadInvoice,
  type DeelInvoiceMatch,
  type PrefixedBreakdown,
} from '../helpers/deel.helper.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';
import { DeelWorkersProvider } from '../providers/deel-workers.provider.js';
import { DeelProvider } from '../providers/deel.provider.js';
import type { DeelModule } from '../types.js';

export const deelResolvers: DeelModule.Resolvers = {
  Mutation: {
    addDeelEmployee: async (_, { deelId, businessId }, { injector }) => {
      try {
        await injector
          .get(DeelWorkersProvider)
          .insertDeelEmployee({ deelId: Number(deelId), businessId });
        return true;
      } catch (error) {
        const message = `Error adding Deel employee [${deelId}]`;
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    addDeelPaymentInfo: async (_, { records }, { injector }) => {
      try {
        const deelDocumentRecords = records.map(record => ({
          ...record,
          contractId: record.contractId ?? null,
          contractOrFeeDescription: record.contractOrFeeDescription ?? null,
          deelWorkerId: record.deelWorkerId ?? null,
          entity: record.entity ?? null,
          workerName: record.workerName ?? null,
        }));
        await injector.get(DeelProvider).insertDeelDocumentRecords({ deelDocumentRecords });
        return true;
      } catch (error) {
        const message = 'Error adding Deel document records';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    fetchDeelDocuments: async (_, __, { injector, adminContext }) => {
      try {
        const invoices = await injector.get(DeelClientProvider).getSalaryInvoices(); // TODO: use PERION_IN_MONTHS
        const receipts = await injector.get(DeelClientProvider).getPaymentReceipts(); // TODO: use PERION_IN_MONTHS

        // filter out known invoices
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
              knownReceiptIds.add(dbInvoice.payment_id);
            } else {
              filteredInvoices.push(invoice);
            }
          }),
        );

        // filter out known receipts
        const filteredReceipts = receipts.data.rows.filter(
          receipt => !knownReceiptIds.has(receipt.id),
        );

        // fetch payment breakdown for each receipt
        const receiptsBreakDown: Array<PaymentBreakdownRecord & { receipt_id: string }> = [];
        for (const receipt of filteredReceipts) {
          if (receipt.id) {
            const breakDown = await injector
              .get(DeelClientProvider)
              .getPaymentBreakdown(receipt.id);
            receiptsBreakDown.push(
              ...breakDown.data.map(row => ({ ...row, receipt_id: receipt.id })),
            );
          }
        }

        // generate charges for new receipts
        const receiptChargeMap = new Map<string, string>();
        for (const receipt of filteredReceipts) {
          const chargePromise = async () => {
            const description = getDeelChargeDescription(receipt.workers);
            const [charge] = await injector.get(ChargesProvider).generateCharge({
              ownerId: adminContext.defaultAdminBusinessId,
              userDescription: description,
            });

            receiptChargeMap.set(receipt.id, charge.id);
            return charge;
          };

          const _charge = await chargePromise();

          // TODO: upload receipt whenever available via Deel API
        }

        // extend invoice data with payment breakdown data
        const matches: DeelInvoiceMatch[] = [];
        filteredInvoices.map(invoice => {
          const optionalMatches = receiptsBreakDown.filter(
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

        for (const match of matches) {
          const documentId = await uploadInvoice(
            receiptChargeMap,
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
