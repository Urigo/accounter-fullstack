import { Injector } from 'graphql-modules';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { GENERAL_FEE_TAX_CATEGORY_ID } from '@shared/constants';
import { ChargeTypeEnum } from '@shared/enums';
import { MissingChargeInfo, ResolversTypes } from '@shared/gql-types';
import { IGetChargesByIdsResult } from '../types.js';
import { getChargeType } from './charge-type.js';

export const validateCharge = async (
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<ResolversTypes['ValidationData']> => {
  const missingInfo: Array<MissingChargeInfo> = [];

  const chargeType = getChargeType(charge);

  const isGeneralFees = charge.tax_category_id === GENERAL_FEE_TAX_CATEGORY_ID;

  // check for consistent counterparty business
  const businessNotRequired =
    [ChargeTypeEnum.InternalTransfer, ChargeTypeEnum.Salary].includes(chargeType) || isGeneralFees;
  const business =
    charge.business_id && !businessNotRequired
      ? await injector.get(BusinessesProvider).getBusinessByIdLoader.load(charge.business_id)
      : undefined;

  const businessIsFine = businessNotRequired || !!business;
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  // validate documents
  const invoicesCount = Number(charge.invoices_count) || 0;
  const receiptsCount = Number(charge.receipts_count) || 0;
  const canSettleWithReceipt = !!(charge.can_settle_with_receipt && receiptsCount > 0);
  const dbDocumentsAreValid = !charge.invalid_documents;
  const documentsNotRequired =
    business?.no_invoices_required === true ||
    [
      ChargeTypeEnum.Salary,
      ChargeTypeEnum.InternalTransfer,
      ChargeTypeEnum.Dividend,
      ChargeTypeEnum.Conversion,
      ChargeTypeEnum.MonthlyVat,
      ChargeTypeEnum.CreditcardBankCharge,
    ].includes(chargeType) ||
    isGeneralFees;
  const documentsAreFine =
    (dbDocumentsAreValid && (invoicesCount > 0 || canSettleWithReceipt)) || documentsNotRequired;
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
  const tags = await injector.get(ChargeTagsProvider).getTagsByChargeIDLoader.load(charge.id);
  const tagsAreFine =
    tags.length > 0 && tags.reduce((partsSum, tag) => partsSum + (tag.part ?? 0), 0) === 1;
  if (!tagsAreFine) {
    missingInfo.push(MissingChargeInfo.Tags);
  }

  // validate vat
  const isVATlessBusiness = business && (business.country !== 'Israel' || business.exempt_dealer);
  const vatIsFine =
    documentsNotRequired ||
    isGeneralFees ||
    (charge.documents_vat_amount != null &&
      (isVATlessBusiness || charge.documents_vat_amount !== 0));
  if (!vatIsFine) {
    missingInfo.push(MissingChargeInfo.Vat);
  }

  // validate tax category
  const shouldHaveTaxCategory = ![ChargeTypeEnum.Salary, ChargeTypeEnum.InternalTransfer].includes(
    chargeType,
  );
  const taxCategoryIsFine = !shouldHaveTaxCategory || !!charge.tax_category_id;
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
