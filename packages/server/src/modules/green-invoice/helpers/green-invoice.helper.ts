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
  mutationInput_addDocument_input_allOf_0_payment_items_appType,
  mutationInput_addDocument_input_allOf_0_payment_items_cardType,
  mutationInput_addDocument_input_allOf_0_payment_items_dealType,
  mutationInput_addDocument_input_allOf_0_payment_items_subType,
  mutationInput_addDocument_input_allOf_0_payment_items_type,
  VatType,
} from '@accounter/green-invoice-graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { IssuedDocumentsProvider } from '@modules/documents/providers/issued-documents.provider.js';
import type { document_status, IInsertDocumentsParams } from '@modules/documents/types';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import {
  Currency,
  DocumentType,
  GreenInvoicePaymentType,
  NewDocumentInfo,
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
import { formatCurrency, hashStringToInt } from '@shared/helpers';

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

export function getTypeFromGreenInvoiceDocument(
  documentType: GreenInvoiceDocumentType,
): DocumentType {
  switch (documentType) {
    case '_305':
      return DocumentType.Invoice;
    case '_300':
      return DocumentType.Proforma;
    case '_320':
      return DocumentType.InvoiceReceipt;
    case '_330':
      return DocumentType.CreditInvoice;
    case '_400':
      return DocumentType.Receipt;
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}

export function getGreenInvoiceDocumentNameFromType(
  documentType: DocumentType | GreenInvoiceDocumentType,
): string {
  switch (documentType) {
    case DocumentType.Invoice:
    case '_305':
      return 'Tax Invoice';
    case DocumentType.Proforma:
    case '_300':
      return 'Proforma Invoice';
    case DocumentType.InvoiceReceipt:
    case '_320':
      return 'Invoice / Receipt';
    case DocumentType.CreditInvoice:
    case '_330':
      return 'Credit Note';
    case DocumentType.Receipt:
    case '_400':
      return 'Receipt';
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

export function getLanguageFromGreenInvoiceDocument(lang: DocumentLang): GreenInvoiceDocumentLang {
  switch (lang) {
    case 'he':
      return 'HEBREW';
    case 'en':
      return 'ENGLISH';
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

export function getGreenInvoiceDocumentPaymentType(
  type: GreenInvoicePaymentType,
): mutationInput_addDocument_input_allOf_0_payment_items_type {
  switch (type) {
    case 'TAX_DEDUCTION':
      return 'NEGATIVE_1';
    case 'CASH':
      return '_1';
    case 'CHEQUE':
      return '_2';
    case 'CREDIT_CARD':
      return '_3';
    case 'WIRE_TRANSFER':
      return '_4';
    case 'PAYPAL':
      return '_5';
    case 'OTHER_DEDUCTION':
      return '_9';
    case 'PAYMENT_APP':
      return '_10';
    case 'OTHER':
      return '_11';
    default:
      throw new Error(`Unsupported payment type: ${type}`);
  }
}

export function getTypeFromGreenInvoiceDocumentPayment(
  type: mutationInput_addDocument_input_allOf_0_payment_items_type,
): GreenInvoicePaymentType {
  switch (type) {
    case 'NEGATIVE_1':
      return 'TAX_DEDUCTION';
    case '_1':
      return 'CASH';
    case '_2':
      return 'CHEQUE';
    case '_3':
      return 'CREDIT_CARD';
    case '_4':
      return 'WIRE_TRANSFER';
    case '_5':
      return 'PAYPAL';
    case '_9':
      return 'OTHER_DEDUCTION';
    case '_10':
      return 'PAYMENT_APP';
    case '_11':
      return 'OTHER';
    default:
      throw new Error(`Unsupported payment type: ${type}`);
  }
}

export function getGreenInvoiceDocumentPaymentSubType(
  subType: GreenInvoicePaymentSubType,
): mutationInput_addDocument_input_allOf_0_payment_items_subType {
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

export function getSubTypeFromGreenInvoiceDocumentPayment(
  subType: mutationInput_addDocument_input_allOf_0_payment_items_subType,
): GreenInvoicePaymentSubType {
  switch (subType) {
    case '_1':
      return 'BITCOIN';
    case '_7':
      return 'BUYME_VOUCHER';
    case '_6':
      return 'ETHEREUM';
    case '_4':
      return 'GIFT_CARD';
    case '_2':
      return 'MONEY_EQUAL';
    case '_5':
      return 'NII_EMPLOYEE_DEDUCTION';
    case '_8':
      return 'PAYONEER';
    case '_3':
      return 'V_CHECK';
    default:
      throw new Error(`Unsupported payment sub-type: ${subType}`);
  }
}

export function getGreenInvoiceDocumentPaymentAppType(
  appType: GreenInvoicePaymentAppType,
): mutationInput_addDocument_input_allOf_0_payment_items_appType {
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

export function getPaymentAppTypeFromGreenInvoiceDocument(
  appType: mutationInput_addDocument_input_allOf_0_payment_items_appType,
): GreenInvoicePaymentAppType {
  switch (appType) {
    case '_6':
      return 'APPLE_PAY';
    case '_1':
      return 'BIT';
    case '_4':
      return 'CULO';
    case '_5':
      return 'GOOGLE_PAY';
    case '_3':
      return 'PAYBOX';
    case '_2':
      return 'PAY_BY_PEPPER';
    default:
      throw new Error(`Unsupported payment app type: ${appType}`);
  }
}

export function getGreenInvoiceDocumentPaymentCardType(
  cardType: GreenInvoicePaymentCardType,
): mutationInput_addDocument_input_allOf_0_payment_items_cardType {
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

export function getCardTypeFromGreenInvoiceDocumentPayment(
  cardType: mutationInput_addDocument_input_allOf_0_payment_items_cardType,
): GreenInvoicePaymentCardType {
  switch (cardType) {
    case '_4':
      return 'AMERICAN_EXPRESS';
    case '_5':
      return 'DINERS';
    case '_1':
      return 'ISRACARD';
    case '_3':
      return 'MASTERCARD';
    // case '_0': // TODO: why is this not supported?
    //   return 'UNKNOWN';
    case '_2':
      return 'VISA';
    default:
      throw new Error(`Unsupported payment card type: ${cardType}`);
  }
}

export function getGreenInvoiceDocumentPaymentDealType(
  dealType: GreenInvoicePaymentDealType,
): mutationInput_addDocument_input_allOf_0_payment_items_dealType {
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

export function getDealTypeFromGreenInvoiceDocumentPayment(
  dealType: mutationInput_addDocument_input_allOf_0_payment_items_dealType,
): GreenInvoicePaymentDealType {
  switch (dealType) {
    case '_3':
      return 'CREDIT';
    case '_4':
      return 'DEFERRED';
    case '_5':
      return 'OTHER';
    case '_2':
      return 'PAYMENTS';
    case '_6':
      return 'RECURRING';
    case '_1':
      return 'STANDARD';
    default:
      throw new Error(`Unsupported payment deal type: ${dealType}`);
  }
}

export function getGreenInvoiceDocumentLinkType(
  linkType: GreenInvoiceLinkType,
): mutationInput_addDocument_input_allOf_0_linkType {
  switch (linkType) {
    case 'CANCEL':
      return 'CANCEL';
    case 'LINK':
      return 'LINK';
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
  const greenInvoiceDocument = await injector
    .get(GreenInvoiceClientProvider)
    .documentLoader.load(externalDocumentId);
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
    const clientPromise = injector
      .get(ClientsProvider)
      .getClientByGreenInvoiceIdLoader.load(greenInvoiceDoc.client.id);

    const linkedDocumentsPromise = getLinkedDocuments(injector, greenInvoiceDoc.id);

    const fileHashPromise = async () => {
      try {
        // Before creating rawDocument
        const fileResponse = await fetch(greenInvoiceDoc.url.origin);
        if (!fileResponse.ok) {
          // Handle error, maybe log and continue with null hash
          throw new Error(`Failed to fetch file from GreenInvoice: ${greenInvoiceDoc.url.origin}`);
        }
        const fileContent = await fileResponse.text();
        const fileHash = hashStringToInt(fileContent).toString();
        return fileHash;
      } catch (error) {
        console.error('Error fetching file for hash calculation:', error);
        return null;
      }
    };

    const [{ imageUrl }, client, linkedDocumentIds, fileHash] = await Promise.all([
      imagePromise,
      clientPromise,
      linkedDocumentsPromise,
      fileHashPromise(),
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

    const counterpartyId = client?.business_id ?? null;

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
      fileHash,
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
      .get(ClientsProvider)
      .getClientByIdLoader.load(initialInput.client.id);
    if (!clientInfo) {
      throw new GraphQLError(`Client with ID ${initialInput.client.id} not found in Green Invoice`);
    }
    const greenInvoiceClient = await injector
      .get(GreenInvoiceClientProvider)
      .clientLoader.load(clientInfo.green_invoice_id);
    if (!greenInvoiceClient) {
      throw new GraphQLError(
        `Green Invoice client with ID ${clientInfo.green_invoice_id} not found`,
      );
    }
    const emails: (string | null)[] = ['ap@the-guild.dev'];
    const inputEmails = initialInput.client?.emails?.filter(Boolean) ?? [];
    if (inputEmails.length) {
      emails.push(...inputEmails);
    } else {
      emails.push(...(greenInvoiceClient.emails ?? []));
    }
    client = {
      id: clientInfo.green_invoice_id,
      country: greenInvoiceClient.country,
      name: greenInvoiceClient.name,
      phone: greenInvoiceClient.phone,
      taxId: greenInvoiceClient.taxId,
      self: false,
      address: greenInvoiceClient.address,
      city: greenInvoiceClient.city,
      zip: greenInvoiceClient.zip,
      fax: greenInvoiceClient.fax,
      mobile: greenInvoiceClient.mobile,
      emails,
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
      type: getGreenInvoiceDocumentPaymentType(payment.type),
      subType: payment.subType ? getGreenInvoiceDocumentPaymentSubType(payment.subType) : undefined,
      appType: payment.appType ? getGreenInvoiceDocumentPaymentAppType(payment.appType) : undefined,
      cardType: payment.cardType
        ? getGreenInvoiceDocumentPaymentCardType(payment.cardType)
        : undefined,
      dealType: payment.dealType
        ? getGreenInvoiceDocumentPaymentDealType(payment.dealType)
        : undefined,
      currency: convertCurrencyToGreenInvoice(payment.currency),
    })),
    linkedDocumentIds: initialInput.linkedDocumentIds?.length
      ? [...initialInput.linkedDocumentIds]
      : undefined,
    linkType: initialInput.linkType
      ? getGreenInvoiceDocumentLinkType(initialInput.linkType)
      : undefined,
  };
}

export function convertGreenInvoiceDocumentToLocalDocumentInfo(
  greenInvoiceDocument: Document,
): NewDocumentInfo {
  return {
    ...greenInvoiceDocument,
    client: greenInvoiceDocument.client
      ? {
          ...greenInvoiceDocument.client,
          emails: greenInvoiceDocument.client.emails
            ? (greenInvoiceDocument.client.emails.filter(Boolean) as string[])
            : [],
        }
      : undefined,
    currency: greenInvoiceDocument.currency as Currency,
    income: greenInvoiceDocument.income?.filter(Boolean).map(income => ({
      ...income!,
      currency: income!.currency as Currency,
      vatType: getVatTypeFromGreenInvoiceDocument(income!.vatType),
    })),
    lang: getLanguageFromGreenInvoiceDocument(greenInvoiceDocument.lang),
    payment: greenInvoiceDocument.payment?.filter(Boolean).map(payment => ({
      ...payment!,
      appType: payment?.appType
        ? getPaymentAppTypeFromGreenInvoiceDocument(payment.appType)
        : undefined,
      cardType: payment?.cardType
        ? getCardTypeFromGreenInvoiceDocumentPayment(payment.cardType)
        : undefined,
      currency: payment!.currency as Currency,
      dealType: payment?.dealType
        ? getDealTypeFromGreenInvoiceDocumentPayment(payment.dealType)
        : undefined,
      subType: payment?.subType
        ? getSubTypeFromGreenInvoiceDocumentPayment(payment.subType)
        : undefined,
      type: getTypeFromGreenInvoiceDocumentPayment(payment!.type),
    })),
    type: getTypeFromGreenInvoiceDocument(greenInvoiceDocument.type),
    vatType: getVatTypeFromGreenInvoiceDocument(greenInvoiceDocument.vatType),
  };
}
