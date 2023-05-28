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
  charge.business_array?.length !== 1;

  const business =
    charge.business_array?.length === 1
      ? await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(charge.business_array[0])
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
    (charge.documents_vat_amount != null &&
      ((business && business.country !== 'Israel') || charge.documents_vat_amount !== 0));
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
