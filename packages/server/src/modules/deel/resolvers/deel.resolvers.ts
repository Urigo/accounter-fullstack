import { GraphQLError } from 'graphql';
import { deleteCharges } from '../../charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { IGetChargesByIdsResult } from '../../charges/types.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import {
  DeelInvoiceMatch,
  fetchAndFilterInvoices,
  fetchPaymentBreakdowns,
  fetchReceipts,
  getChargeMatchesForPayments,
  getContractsFromPaymentBreakdowns,
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

        const receipts = await fetchReceipts(injector);

        const paymentBreakdowns = await fetchPaymentBreakdowns(injector, receipts);

        const { matches, unmatched } = matchInvoicesWithPayments(invoices, paymentBreakdowns);

        if (matches.length + unmatched.length <= 0) {
          return [];
        }

        // fetch contacts and validate
        const contractsInfo = getContractsFromPaymentBreakdowns(matches);
        await validateContracts(contractsInfo, injector);

        const { receiptChargeMap, invoiceChargeMap } = await getChargeMatchesForPayments(
          injector,
          adminContext.defaultAdminBusinessId,
          receipts,
        );

        const updatedChargeIdsSet = new Set<string>(receiptChargeMap.values());

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

          const match: DeelInvoiceMatch = {
            ...invoice,
            breakdown_receipt_id: '',
            breakdown_adjustment: '0.00',
            breakdown_approve_date: '',
            breakdown_approvers: '',
            breakdown_bonus: '0.00',
            breakdown_commissions: '0.00',
            breakdown_contract_country: '',
            breakdown_contract_start_date: '',
            breakdown_contract_type: '',
            breakdown_contractor_email: '',
            breakdown_contractor_employee_name: '',
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
          };

          await insertDeelInvoiceRecord(context, match, charge.id);
        }

        // insert/update matched Deel invoice records
        for (const match of matches) {
          const chargeId =
            invoiceChargeMap.get(match.id) ?? receiptChargeMap.get(match.breakdown_receipt_id);
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
