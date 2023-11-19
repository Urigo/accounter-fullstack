import { Injector } from 'graphql-modules';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { MissingChargeInfo, ResolversTypes } from '@shared/gql-types';
import { IGetChargesByIdsResult } from '../types.js';

export const validateCharge = async (
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<ResolversTypes['ValidationData']> => {
  const missingInfo: Array<MissingChargeInfo> = [];

  // check for consistent counterparty business
  const business = charge.business_id
    ? await injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(charge.business_id)
    : undefined;

  const businessIsFine = !!business || !!charge.is_salary;
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  // validate documents
  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const canSettleWithReceipt = !!(charge.can_settle_with_receipt && receiptsCount > 0);
  const dbDocumentsAreValid = !charge.invalid_documents;
  const documentsAreFine =
    business?.no_invoices_required ||
    (dbDocumentsAreValid && (invoicesCount > 0 || canSettleWithReceipt)) ||
    !!charge.is_salary;
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  // validate transactions
  const hasTransaction = charge.transactions_event_amount != null;
  const dbTransactionsAreValid = !charge.invalid_transactions;
  const transactionsAreFine = hasTransaction && dbTransactionsAreValid;
  if (!transactionsAreFine) {
    missingInfo.push(MissingChargeInfo.Transactions);
  }

  // validate description
  const descriptionIsFine = (charge.user_description?.trim().length ?? 0) > 0;
  if (!descriptionIsFine) {
    missingInfo.push(MissingChargeInfo.Description);
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
    (charge.documents_vat_amount != null &&
      ((business && business.country !== 'Israel') || charge.documents_vat_amount !== 0)) ||
    !!charge.is_salary;
  if (!vatIsFine) {
    missingInfo.push(MissingChargeInfo.Vat);
  }

  // validate tax category
  const taxCategoryIsFine = !!charge.tax_category_id;
  if (!taxCategoryIsFine) {
    missingInfo.push(MissingChargeInfo.TaxCategory);
  }

  //TODO(Gil): validate balance
  //TODO(Gil): validate ledger

  const allFine =
    documentsAreFine &&
    businessIsFine &&
    descriptionIsFine &&
    tagsAreFine &&
    vatIsFine &&
    transactionsAreFine &&
    taxCategoryIsFine;

  return {
    isValid: allFine,
    missingInfo,
  };
};
