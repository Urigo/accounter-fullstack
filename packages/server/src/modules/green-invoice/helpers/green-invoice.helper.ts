import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type {
  Document,
  DocumentInputNew_Input,
  DocumentLang,
  DocumentLinkedDocument,
  ExpenseDocumentType,
  Currency as GreenInvoiceCurrency,
  DocumentType as GreenInvoiceDocumentType,
  mutationInput_addDocument_input_allOf_0_client_Input,
  mutationInput_addDocument_input_allOf_0_discount_type,
  mutationInput_addDocument_input_allOf_0_linkType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_0_subType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_appType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_cardType,
  mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_dealType,
  VatType,
} from '@accounter/green-invoice-graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import type { document_status, IInsertDocumentsParams } from '@modules/documents/types';
import {
  Currency,
  DocumentType,
  NewDocumentInput,
  type GreenInvoiceDiscountType,
  type GreenInvoiceDocumentLang,
  type GreenInvoiceLinkType,
  type GreenInvoicePaymentAppType,
  type GreenInvoicePaymentCardType,
  type GreenInvoicePaymentDealType,
  type GreenInvoicePaymentSubType,
  type GreenInvoiceVatType,
} from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import { GreenInvoiceProvider } from '../providers/green-invoice.provider.js';

export function normalizeDocumentType(
  rawType?: GreenInvoiceDocumentType | ExpenseDocumentType | number | null,
): DocumentType {
  if (!rawType) {
    return DocumentType.Unprocessed;
  }

  if (typeof rawType === 'string' && rawType.startsWith('_')) {
    const int = parseInt(rawType.replace('_', ''));
    if (Number.isInteger(int)) {
      rawType = int;
    }
  }

  switch (rawType) {
    case 20:
      // חשבון / אישור תשלום
      return DocumentType.Invoice;
    case 300:
      // חשבונית עסקה
      return DocumentType.Proforma;
    case 305:
      // חשבונית מס
      return DocumentType.Invoice;
    case 320:
      // חשבונית מס\קבלה
      return DocumentType.InvoiceReceipt;
    case 330:
      // חשבונית זיכוי
      return DocumentType.CreditInvoice;
    case 400:
      // קבלה
      return DocumentType.Receipt;
    case 405:
      // קבלה על תרומה
      return DocumentType.Unprocessed;
    default:
      console.log(`Got a new document type from Green Invoice: ${rawType}`);
      return DocumentType.Unprocessed;
  }
}

export function getGreenInvoiceDocumentType(documentType: DocumentType): GreenInvoiceDocumentType {
  switch (documentType) {
    case DocumentType.Invoice:
      return '_305';
    case DocumentType.Proforma:
      return '_300';
    case DocumentType.InvoiceReceipt:
      return '_320';
    case DocumentType.CreditInvoice:
      return '_330';
    case DocumentType.Receipt:
      return '_400';
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

export function getGreenInvoiceDocumentLanguage(lang: GreenInvoiceDocumentLang): DocumentLang {
  switch (lang) {
    case 'HEBREW':
      return 'he';
    case 'ENGLISH':
      return 'en';
    default:
      throw new Error(`Unsupported document language: ${lang}`);
  }
}

export function getGreenInvoiceDocumentVatType(vatType: GreenInvoiceVatType): VatType {
  switch (vatType) {
    case 'DEFAULT':
      return '_0';
    case 'EXEMPT':
      return '_1';
    case 'MIXED':
      return '_2';
    default:
      throw new Error(`Unsupported VAT type: ${vatType}`);
  }
}

export function getVatTypeFromGreenInvoiceDocument(vatType: VatType): GreenInvoiceVatType {
  switch (vatType) {
    case '_0':
      return 'DEFAULT';
    case '_1':
      return 'EXEMPT';
    case '_2':
      return 'MIXED';
    default:
      throw new Error(`Unsupported VAT type: ${vatType}`);
  }
}

export function getGreenInvoiceDocumentDiscountType(
  discountType: GreenInvoiceDiscountType,
): mutationInput_addDocument_input_allOf_0_discount_type {
  switch (discountType) {
    case 'PERCENTAGE':
      return 'percentage';
    case 'SUM':
      return 'sum';
    default:
      throw new Error(`Unsupported discount type: ${discountType}`);
  }
}

export function getGreenInvoiceDocumentPaymentSubType(
  subType: GreenInvoicePaymentSubType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_0_subType {
  switch (subType) {
    case 'BITCOIN':
      return '_1';
    case 'BUYME_VOUCHER':
      return '_7';
    case 'ETHEREUM':
      return '_6';
    case 'GIFT_CARD':
      return '_4';
    case 'MONEY_EQUAL':
      return '_2';
    case 'NII_EMPLOYEE_DEDUCTION':
      return '_5';
    case 'PAYONEER':
      return '_8';
    case 'V_CHECK':
      return '_3';
    default:
      throw new Error(`Unsupported payment sub-type: ${subType}`);
  }
}

export function getGreenInvoiceDocumentPaymentAppType(
  appType: GreenInvoicePaymentAppType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_appType {
  switch (appType) {
    case 'APPLE_PAY':
      return '_6';
    case 'BIT':
      return '_1';
    case 'CULO':
      return '_4';
    case 'GOOGLE_PAY':
      return '_5';
    case 'PAYBOX':
      return '_3';
    case 'PAY_BY_PEPPER':
      return '_2';
    default:
      throw new Error(`Unsupported payment app type: ${appType}`);
  }
}

export function getGreenInvoiceDocumentPaymentCardType(
  cardType: GreenInvoicePaymentCardType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_cardType {
  switch (cardType) {
    case 'AMERICAN_EXPRESS':
      return '_4';
    case 'DINERS':
      return '_5';
    case 'ISRACARD':
      return '_1';
    case 'MASTERCARD':
      return '_3';
    // case 'UNKNOWN':
    //   return '_0'; // TODO: why is this not supported?
    case 'VISA':
      return '_2';
    default:
      throw new Error(`Unsupported payment card type: ${cardType}`);
  }
}

export function getGreenInvoiceDocumentPaymentDealType(
  dealType: GreenInvoicePaymentDealType,
): mutationInput_addDocument_input_allOf_0_payment_items_allOf_1_dealType {
  switch (dealType) {
    case 'CREDIT':
      return '_3';
    case 'DEFERRED':
      return '_4';
    case 'OTHER':
      return '_5';
    case 'PAYMENTS':
      return '_2';
    case 'RECURRING':
      return '_6';
    case 'STANDARD':
      return '_1';
    default:
      throw new Error(`Unsupported payment deal type: ${dealType}`);
  }
}

export function getGreenInvoiceDocumentLinkType(
  linkType: GreenInvoiceLinkType,
): mutationInput_addDocument_input_allOf_0_linkType {
  switch (linkType) {
    case 'CANCEL':
      return 'cancel';
    case 'LINK':
      return 'link';
    default:
      throw new Error(`Unsupported link type: ${linkType}`);
  }
}

export function convertCurrencyToGreenInvoice(currency: Currency): GreenInvoiceCurrency {
  switch (currency) {
    case Currency.Aud:
      return 'AUD';
    case Currency.Cad:
      return 'CAD';
    case Currency.Eur:
      return 'EUR';
    case Currency.Gbp:
      return 'GBP';
    case Currency.Ils:
      return 'ILS';
    case Currency.Jpy:
      return 'JPY';
    case Currency.Sek:
      return 'SEK';
    case Currency.Usd:
      return 'USD';
    case Currency.Eth:
    case Currency.Grt:
    case Currency.Usdc:
      throw new Error(`Crypto currency (${currency}) is not supported`);
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}

export function greenInvoiceToDocumentStatus(greenInvoiceStatus: number): document_status {
  switch (greenInvoiceStatus) {
    case 0:
      return 'OPEN';
    case 1:
      return 'CLOSED';
    case 2:
      return 'MANUALLY_CLOSED';
    case 3:
      return 'CANCELLED_BY_OTHER_DOC';
    case 4:
      return 'CANCELLED';
    default:
      throw new Error(`Unsupported Green Invoice document status: ${greenInvoiceStatus}`);
  }
}

export async function getLinkedDocuments(
  injector: Injector,
  externalDocumentId: string,
): Promise<string[] | null> {
  const greenInvoiceDocument = await injector.get(GreenInvoiceClientProvider).getDocument({
    id: externalDocumentId,
  });
  if (!greenInvoiceDocument?.linkedDocuments) {
    return null;
  }

  const linkedDocuments = greenInvoiceDocument.linkedDocuments.filter(
    Boolean,
  ) as DocumentLinkedDocument[];
  if (!linkedDocuments.length) {
    return null;
  }

  const linkedDocumentsIds: string[] = [];
  await Promise.all(
    linkedDocuments.map(async linkedDocument => {
      const issuedDocument = await injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByExternalIdLoader.load(linkedDocument.id);

      if (!issuedDocument?.id) {
        throw new GraphQLError(
          `Linked document with ID ${linkedDocument.id} not found in issued documents`,
        );
      }

      linkedDocumentsIds.push(issuedDocument.id);
    }),
  );

  return linkedDocumentsIds;
}

export async function insertNewDocumentFromGreenInvoice(
  injector: Injector,
  greenInvoiceDoc: Document,
  ownerId: string,
  preDictatedChargeId?: string | null,
) {
  const documentType = normalizeDocumentType(greenInvoiceDoc.type);
  const isOwnerCreditor = greenInvoiceDoc.amount > 0 && documentType !== DocumentType.CreditInvoice;

  try {
    // generate preview image via cloudinary
    const imagePromise = injector
      .get(CloudinaryProvider)
      .uploadInvoiceToCloudinary(greenInvoiceDoc.url.origin);

    // Get matching business
    const businessPromise = injector
      .get(GreenInvoiceProvider)
      .getBusinessMatchByGreenInvoiceIdLoader.load(greenInvoiceDoc.client.id);

    const linkedDocumentsPromise = getLinkedDocuments(injector, greenInvoiceDoc.id);

    const [{ imageUrl }, business, linkedDocumentIds] = await Promise.all([
      imagePromise,
      businessPromise,
      linkedDocumentsPromise,
    ]);

    let chargeId: string | null = preDictatedChargeId || null;
    // if linked documents exist, use the first one to get the charge ID
    if (!chargeId && linkedDocumentIds?.length) {
      const linkedDocId = linkedDocumentIds[0];
      const document = await injector
        .get(DocumentsProvider)
        .getDocumentsByIdLoader.load(linkedDocId);

      if (document?.charge_id) {
        chargeId = document.charge_id;
      }
    }

    if (!chargeId) {
      // Generate new parent charge

      let userDescription = 'Green Invoice generated charge';

      const income = greenInvoiceDoc.income;
      if (income && income.length > 0 && income[0]!.description && income[0]!.description !== '') {
        userDescription = income
          .filter(item => item?.description)
          .map(item => item!.description)
          .join(', ');
      } else if (greenInvoiceDoc.description && greenInvoiceDoc.description !== '') {
        userDescription = greenInvoiceDoc.description;
      }

      const [charge] = await injector.get(ChargesProvider).generateCharge({
        ownerId,
        userDescription,
      });
      if (!charge) {
        throw new Error('Failed to generate charge');
      }
      chargeId = charge.id;
    }

    const counterpartyId = business?.business_id ?? null;

    // insert document
    const rawDocument: IInsertDocumentsParams['document']['0'] = {
      image: imageUrl,
      file: greenInvoiceDoc.url.origin,
      documentType,
      serialNumber: greenInvoiceDoc.number,
      date: greenInvoiceDoc.documentDate,
      amount: greenInvoiceDoc.amount,
      currencyCode: formatCurrency(greenInvoiceDoc.currency),
      vat: greenInvoiceDoc.vat,
      chargeId,
      vatReportDateOverride: null,
      noVatAmount: null,
      creditorId: isOwnerCreditor ? ownerId : counterpartyId,
      debtorId: isOwnerCreditor ? counterpartyId : ownerId,
      allocationNumber: null, // TODO: add allocation number from GreenInvoice API
      exchangeRateOverride: null,
    };

    const newDocumentResponse = await injector
      .get(DocumentsProvider)
      .insertDocuments({ document: [rawDocument] });
    if (!newDocumentResponse || newDocumentResponse.length === 0) {
      throw new Error('Failed to insert document');
    }
    const newDocument = newDocumentResponse[0];

    // insert issued document
    await injector
      .get(IssuedDocumentsProvider)
      .insertIssuedDocuments({
        issuedDocuments: [
          {
            external_id: greenInvoiceDoc.id,
            id: newDocument.id,
            status: greenInvoiceToDocumentStatus(greenInvoiceDoc.status),
            linked_document_ids: linkedDocumentIds,
          },
        ],
      })
      .catch(e => {
        console.error('Failed to insert issued document', e);
        throw new GraphQLError(
          `Failed to insert issued document for Green Invoice ID: ${greenInvoiceDoc.id}`,
        );
      });

    return newDocument;
  } catch (e) {
    throw new GraphQLError(
      `Error adding Green Invoice document: ${e}\n\n${JSON.stringify(greenInvoiceDoc, null, 2)}`,
    );
  }
}

export async function getGreenInvoiceDocuments(injector: Injector, recursive: boolean = false) {
  const documents: Document[] = [];
  async function getDocuments(page: number = 1) {
    const data = await injector.get(GreenInvoiceClientProvider).searchDocuments({
      input: { pageSize: 100, sort: 'creationDate', page },
    });
    if (!data?.items) {
      if (!recursive) {
        throw new GraphQLError('Failed to fetch documents');
      }
      return;
    }

    documents.push(...data.items.filter(item => item !== null));

    if (data.items.length < 100) {
      return;
    }

    if (recursive) {
      await getDocuments(page + 1);
    }
  }

  await getDocuments();

  return documents;
}

export async function convertDocumentInputIntoGreenInvoiceInput(
  initialInput: NewDocumentInput,
  injector: Injector,
): Promise<DocumentInputNew_Input> {
  let client: mutationInput_addDocument_input_allOf_0_client_Input | undefined = undefined;
  if (initialInput.client) {
    const clientInfo = await injector
      .get(GreenInvoiceProvider)
      .getBusinessMatchByIdLoader.load(initialInput.client.id);
    if (!clientInfo) {
      throw new GraphQLError(`Client with ID ${initialInput.client.id} not found in Green Invoice`);
    }
    client = {
      id: clientInfo.green_invoice_id,
      emails: initialInput.client.emails?.length ? [...initialInput.client.emails] : undefined,
    };
  }
  return {
    ...initialInput,
    currency: convertCurrencyToGreenInvoice(initialInput.currency),
    type: getGreenInvoiceDocumentType(initialInput.type),
    lang: getGreenInvoiceDocumentLanguage(initialInput.lang),
    vatType: getGreenInvoiceDocumentVatType(initialInput.vatType ?? 'DEFAULT'),
    discount: initialInput.discount
      ? {
          ...initialInput.discount,
          type: getGreenInvoiceDocumentDiscountType(initialInput.discount.type),
        }
      : undefined,
    client,
    income:
      initialInput.income?.map(income => ({
        ...income,
        currency: convertCurrencyToGreenInvoice(income.currency),
        vatType: getGreenInvoiceDocumentVatType(income.vatType ?? 'DEFAULT'),
      })) ?? [],
    payment: initialInput.payment?.map(payment => ({
      ...payment,
      subType: payment.subType ? getGreenInvoiceDocumentPaymentSubType(payment.subType) : undefined,
      appType: payment.appType ? getGreenInvoiceDocumentPaymentAppType(payment.appType) : undefined,
      cardType: payment.cardType
        ? getGreenInvoiceDocumentPaymentCardType(payment.cardType)
        : undefined,
      dealType: payment.dealType
        ? getGreenInvoiceDocumentPaymentDealType(payment.dealType)
        : undefined,
    })),
    linkedDocumentIds: initialInput.linkedDocumentIds?.length
      ? [...initialInput.linkedDocumentIds]
      : undefined,
    linkType: initialInput.linkType
      ? getGreenInvoiceDocumentLinkType(initialInput.linkType)
      : undefined,
  };
}
