import { Injector } from 'graphql-modules';
import type { ResolversTypes } from '../../../__generated__/types.js';
import { ChargeTypeEnum, MissingChargeInfo } from '../../../shared/enums.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { isInvoice } from '../../documents/helpers/common.helper.js';
import {
  basicDocumentValidation,
  validateDocumentAllocation,
} from '../../documents/helpers/validate-document.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import type { IGetChargesByIdsResult } from '../types.js';
import { getChargeType } from './charge-type.js';
import {
  getChargeBusinesses,
  getChargeDocumentsMeta,
  getChargeTaxCategoryId,
  getChargeTransactionsMeta,
  isEnrichedFilteredCharge,
} from './common.helper.js';

export const validateCharge = async (
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<ResolversTypes['ValidationData']> => {
  const missingInfo: Array<MissingChargeInfo> = [];

  const [chargeType, { mainBusinessId }, taxCategoryId] = await Promise.all([
    getChargeType(charge, injector),
    getChargeBusinesses(charge, injector),
    getChargeTaxCategoryId(charge, injector),
  ]);

  const adminContext = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  const isGeneralFees =
    taxCategoryId === adminContext.general.taxCategories.generalFeeTaxCategoryId;

  // check for consistent counterparty business
  const businessNotRequired =
    [ChargeTypeEnum.InternalTransfer, ChargeTypeEnum.Salary, ChargeTypeEnum.Financial].includes(
      chargeType,
    ) || isGeneralFees;
  const businessPromise =
    mainBusinessId && !businessNotRequired
      ? injector.get(BusinessesProvider).getBusinessByIdLoader.load(mainBusinessId)
      : Promise.resolve(undefined);

  const [
    business,
    { invalidTransactions, transactionsCount },
    { documentsVatAmount, invoiceCount, receiptCount },
  ] = await Promise.all([
    businessPromise,
    getChargeTransactionsMeta(charge, injector),
    getChargeDocumentsMeta(charge, injector),
  ]);

  const businessIsFine = businessNotRequired || !!business;
  if (!businessIsFine) {
    missingInfo.push(MissingChargeInfo.Counterparty);
  }

  // validate documents
  let shouldHaveDocuments = true;
  switch (chargeType) {
    case ChargeTypeEnum.Salary:
    case ChargeTypeEnum.InternalTransfer:
    case ChargeTypeEnum.Dividend:
    case ChargeTypeEnum.Conversion:
    case ChargeTypeEnum.MonthlyVat:
    case ChargeTypeEnum.CreditcardBankCharge:
    case ChargeTypeEnum.Financial:
    case ChargeTypeEnum.BusinessTrip:
    case ChargeTypeEnum.BankDeposit:
    case ChargeTypeEnum.ForeignSecurities:
      shouldHaveDocuments = false;
  }
  if (isGeneralFees || business?.no_invoices_required === true || charge.documents_optional_flag) {
    shouldHaveDocuments = false;
  }
  let documentsAreFine: boolean;
  if (shouldHaveDocuments) {
    const documents = await injector
      .get(DocumentsProvider)
      .getDocumentsByChargeIdLoader.load(charge.id);
    let missingAllocationNumber = false;
    await Promise.all(
      documents.map(async doc => {
        if (isInvoice(doc.type)) {
          const validAllocation = await validateDocumentAllocation(doc, injector);
          if (!validAllocation) {
            missingAllocationNumber = true;
          }
        }
      }),
    );
    const isReceiptEnough = !!(business?.can_settle_with_receipt && receiptCount > 0);
    // Derived from the loaded documents (not the meta helper) so enriched
    // charge rows keep the exact basicDocumentValidation semantics.
    const dbDocumentsAreValid = !documents.some(doc => !basicDocumentValidation(doc));
    documentsAreFine =
      dbDocumentsAreValid && (invoiceCount > 0 || isReceiptEnough) && !missingAllocationNumber;
  } else {
    documentsAreFine = true;
  }
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  // validate transactions
  const hasTransaction = transactionsCount >= 1;
  const transactionsNotRequired = [ChargeTypeEnum.Financial].includes(chargeType);
  const transactionsAreFine = transactionsNotRequired || (hasTransaction && !invalidTransactions);
  if (!transactionsAreFine) {
    missingInfo.push(MissingChargeInfo.Transactions);
  }

  // validate description
  const descriptionIsFine = (charge.user_description?.trim().length ?? 0) > 0;
  if (!descriptionIsFine) {
    missingInfo.push(MissingChargeInfo.Description);
  }

  // validate tags
  const tagsAreFine = isEnrichedFilteredCharge(charge)
    ? (charge.tags ?? []).length > 0
    : (await injector.get(ChargeTagsProvider).getTagsByChargeIDLoader.load(charge.id)).length > 0;
  if (!tagsAreFine) {
    missingInfo.push(MissingChargeInfo.Tags);
  }

  // validate vat
  const isVATlessBusiness =
    charge.optional_vat ||
    (business &&
      (business.country !== adminContext.locality ||
        business.exempt_dealer ||
        business.optional_vat));
  const vatIsFine =
    !shouldHaveDocuments ||
    isGeneralFees ||
    (documentsVatAmount != null && (isVATlessBusiness || documentsVatAmount !== 0));
  if (!vatIsFine) {
    missingInfo.push(MissingChargeInfo.Vat);
  }

  // validate tax category
  const shouldHaveTaxCategory = ![
    ChargeTypeEnum.Salary,
    ChargeTypeEnum.InternalTransfer,
    ChargeTypeEnum.ForeignSecurities,
  ].includes(chargeType);
  const taxCategoryIsFine = !shouldHaveTaxCategory || !!taxCategoryId;
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
