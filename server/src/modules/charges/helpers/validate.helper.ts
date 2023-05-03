import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { ChargeResolvers, MissingChargeInfo } from '@shared/gql-types';

export const validateCharge: ChargeResolvers['validationData'] = async (
  charge,
  _,
  { injector },
) => {
  const missingInfo: Array<MissingChargeInfo> = [];

  const documents = await injector
    .get(DocumentsProvider)
    .getDocumentsByChargeIdLoader.load(charge.id);
  const transactions = await injector
    .get(TransactionsProvider)
    .getTransactionsByChargeIDLoader.load(charge.id);

  // check for consistent counterparty business
  const counterpartyIDs = new Set<string>();
  documents.map(d => {
    if (d.creditor_id && d.creditor_id !== charge.owner_id) counterpartyIDs.add(d.creditor_id);
    if (d.debtor_id && d.debtor_id !== charge.owner_id) counterpartyIDs.add(d.debtor_id);
  });
  transactions.map(t => {
    if (t.business_id) counterpartyIDs.add(t.business_id);
  });

  const business =
    counterpartyIDs.size === 1
      ? await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(counterpartyIDs.values().next().value)
      : undefined;

  const businessIsFine = !!business;
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  // validate documents
  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const isForeignExpense =
    business?.country !== 'Israel' && Number(charge.transactions_event_amount) < 0;
  const canSettleWithReceipt = isForeignExpense && receiptsCount > 0;
  const documentsAreFine =
    business?.no_invoices_required || invoicesCount > 0 || canSettleWithReceipt;
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  // validate description
  const descriptionIsFine = (charge.user_description?.trim().length ?? 0) > 0;
  if (!descriptionIsFine) {
    missingInfo.push(MissingChargeInfo.TransactionDescription);
  }

  // validate tags
  const tags = await injector.get(TagsProvider).getTagsByChargeIDLoader.load(charge.id);
  const tagsAreFine = tags.length > 0;
  if (!tagsAreFine) {
    missingInfo.push(MissingChargeInfo.Tags);
  }

  // validate vat
  const vatIsFine =
    business?.no_invoices_required ||
    (charge.documents_vat_amount != null && charge.documents_vat_amount != 0);
  if (!vatIsFine) {
    missingInfo.push(MissingChargeInfo.Vat);
  }

  //TODO(Gil): validate balance

  const allFine =
    documentsAreFine && businessIsFine && descriptionIsFine && tagsAreFine && vatIsFine;

  return {
    isValid: allFine,
    missingInfo,
  };
};
