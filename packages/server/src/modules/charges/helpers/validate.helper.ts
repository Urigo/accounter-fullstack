import { validateDocumentAllocation } from '@modules/documents/helpers/validate-document.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ChargeTagsProvider } from '@modules/tags/providers/charge-tags.provider.js';
import { ChargeTypeEnum } from '@shared/enums';
import { DocumentType, MissingChargeInfo, ResolversTypes } from '@shared/gql-types';
import { IGetChargesByIdsResult } from '../types.js';
import { getChargeType } from './charge-type.js';

export const validateCharge = async (
  charge: IGetChargesByIdsResult,
  context: GraphQLModules.Context,
): Promise<ResolversTypes['ValidationData']> => {
  const { injector, adminContext } = context;
  const missingInfo: Array<MissingChargeInfo> = [];

  const chargeType = getChargeType(charge, context);

  const isGeneralFees =
    charge.tax_category_id === adminContext.general.taxCategories.generalFeeTaxCategoryId;

  // check for consistent counterparty business
  const businessNotRequired =
    [ChargeTypeEnum.InternalTransfer, ChargeTypeEnum.Salary, ChargeTypeEnum.Financial].includes(
      chargeType,
    ) || isGeneralFees;
  const business =
    charge.business_id && !businessNotRequired
      ? await injector.get(BusinessesProvider).getBusinessByIdLoader.load(charge.business_id)
      : undefined;

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
      shouldHaveDocuments = false;
  }
  if (isGeneralFees || business?.no_invoices_required === true || charge.documents_optional_flag) {
    shouldHaveDocuments = false;
  }
  let documentsAreFine = false;
  if (shouldHaveDocuments) {
    const documents = await injector
      .get(DocumentsProvider)
      .getDocumentsByChargeIdLoader.load(charge.id);
    let invoicesCount = 0;
    let receiptsCount = 0;
    let missingAllocationNumber = false;
    await Promise.all(
      documents.map(async doc => {
        if (
          [DocumentType.Invoice, DocumentType.CreditInvoice, DocumentType.InvoiceReceipt].includes(
            doc.type as DocumentType,
          )
        ) {
          invoicesCount++;
          const validAllocation = await validateDocumentAllocation(doc, context);
          if (!validAllocation) {
            missingAllocationNumber = true;
          }
        }
        if (
          [DocumentType.Receipt, DocumentType.InvoiceReceipt].includes(doc.type as DocumentType)
        ) {
          receiptsCount++;
        }
      }),
    );
    const isReceiptEnough = !!(charge.can_settle_with_receipt && receiptsCount > 0);
    const dbDocumentsAreValid = !charge.invalid_documents;
    documentsAreFine =
      dbDocumentsAreValid && (invoicesCount > 0 || isReceiptEnough) && !missingAllocationNumber;
  } else {
    documentsAreFine = true;
  }
  if (!documentsAreFine) {
    missingInfo.push(MissingChargeInfo.Documents);
  }

  // validate transactions
  const hasTransaction = charge.transactions_event_amount != null;
  const transactionsNotRequired = [ChargeTypeEnum.Financial].includes(chargeType);
  const dbTransactionsAreValid = !charge.invalid_transactions;
  const transactionsAreFine = transactionsNotRequired || (hasTransaction && dbTransactionsAreValid);
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
  const tagsAreFine = tags.length > 0;
  //  && tags.reduce((partsSum, tag) => partsSum + (tag.part ?? 0), 0) === 1;
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
