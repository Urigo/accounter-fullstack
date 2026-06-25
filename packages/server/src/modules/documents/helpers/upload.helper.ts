import type { Injector } from 'graphql-modules';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { hashStringToInt } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AnthropicProvider } from '../../app-providers/anthropic.js';
import type { BusinessMatchData } from '../../app-providers/helpers/business-matcher.helper.js';
import { CloudinaryProvider } from '../../app-providers/cloudinary.js';
import { suggestionDataSchema } from '../../financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import type { IInsertDocumentsParams } from '../types.js';

const toBase64 = async (file: File | Blob): Promise<string> => {
  const base64string = Buffer.from(await file.arrayBuffer()).toString('base64');
  return 'data:' + file.type + ';base64,' + base64string;
};

export const uploadToCloudinary = async (injector: Injector, file: File | Blob) => {
  const base64string = await toBase64(file).catch(err => {
    throw new Error(`Failed to convert file to base64: ${err.message}`);
  });

  try {
    return injector.get(CloudinaryProvider).uploadInvoiceToCloudinary(base64string);
  } catch (e) {
    const message = 'Error on uploading file to cloudinary';
    console.error(`${message}: ${e}`);
    throw new Error(message, { cause: e });
  }
};

export type OcrData = {
  isOwnerIssuer?: boolean;
  counterpartyId?: string;
  documentType: DocumentType;
  serial?: string;
  date?: Date;
  amount?: number;
  currency?: Currency;
  vat?: number;
  allocationNumber?: string;
  description?: string;
  remarks?: string;
  suggestedIssuer?: string;
  suggestedRecipient?: string;
};

async function fetchBusinessesForMatching(injector: Injector): Promise<BusinessMatchData[]> {
  try {
    const rawBusinesses = await injector.get(BusinessesProvider).getAllBusinesses();
    return rawBusinesses.map(b => ({
      id: b.id,
      name: b.name ?? null,
      hebrew_name: b.hebrew_name ?? null,
      vat_number: b.vat_number ?? null,
      suggestion_data: suggestionDataSchema.safeParse(b.suggestion_data).data ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getOcrData(
  injector: Injector,
  file: File | Blob,
  isSensitive: boolean | null = true,
): Promise<OcrData> {
  const validateNumber = (value: unknown): number | undefined => {
    return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
  };

  const validateDate = (value?: string): Date | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  if (isSensitive) {
    return {
      documentType: DocumentType.Unprocessed,
    };
  }

  const businesses = await fetchBusinessesForMatching(injector);
  const draft = await injector.get(AnthropicProvider).extractInvoiceDetails(file, businesses);

  if (!draft) {
    throw new Error('No data returned from Anthropic OCR');
  }

  return {
    suggestedIssuer: draft.suggestedIssuer ?? undefined,
    suggestedRecipient: draft.suggestedRecipient ?? undefined,
    documentType: draft.type ?? DocumentType.Unprocessed,
    serial: draft.referenceCode ?? undefined,
    date: validateDate(draft.date ?? undefined),
    amount: validateNumber(draft.fullAmount),
    currency: draft.currency,
    vat: validateNumber(draft.vatAmount),
    allocationNumber: draft.allocationNumber ?? undefined,
    description: draft.description ?? undefined,
    remarks: draft.issuer,
  };
}

async function getHashFromFile(file: File | Blob): Promise<number> {
  return hashStringToInt(await file.text());
}

function figureOutSides(
  documentType: DocumentType,
  ownerId: string,
  isOwnerIssuer?: boolean,
  counterPartyId?: string,
): { creditorId?: string; debtorId?: string } {
  if (documentType === DocumentType.Unprocessed || documentType === DocumentType.Other) {
    return {};
  }

  let res: {
    creditorId: string | undefined;
    debtorId: string | undefined;
  } = {
    creditorId: counterPartyId,
    debtorId: ownerId,
  };

  if (isOwnerIssuer === true) {
    res = {
      creditorId: res.debtorId,
      debtorId: res.creditorId,
    };
  }

  if (documentType === DocumentType.CreditInvoice) {
    res = {
      creditorId: res.debtorId,
      debtorId: res.creditorId,
    };
  }

  return res;
}

export function getDocumentFromUrlsAndOcrData(
  fileUrl: string,
  imageUrl: string,
  ocrData: OcrData,
  adminBusinessId: string,
  chargeId?: string | null,
  fileHash?: number,
): IInsertDocumentsParams['documents'][number] {
  const sides = figureOutSides(
    ocrData.documentType,
    adminBusinessId,
    ocrData.isOwnerIssuer,
    ocrData.counterpartyId,
  );

  const newDocument: IInsertDocumentsParams['documents'][number] = {
    ownerId: adminBusinessId,
    image: imageUrl ?? null,
    file: fileUrl ?? null,
    documentType: ocrData.documentType,
    serialNumber: ocrData.serial ?? null,
    date: ocrData.date ?? null,
    amount: ocrData.amount ?? null,
    currencyCode: ocrData.currency ?? null,
    vat: ocrData.vat ?? null,
    chargeId: chargeId ?? null,
    vatReportDateOverride: null,
    noVatAmount: null,
    allocationNumber: ocrData.allocationNumber ?? null,
    exchangeRateOverride: null,
    fileHash: fileHash?.toString() ?? null,
    description: ocrData.description ?? null,
    remarks: ocrData.remarks ?? null,
    creditorId: sides.creditorId ?? null,
    debtorId: sides.debtorId ?? null,
  };

  return newDocument;
}

function resolveOwnerSideFromUuids(ocrData: OcrData, ownerId: string): void {
  const { suggestedIssuer, suggestedRecipient } = ocrData;
  if (suggestedIssuer == null && suggestedRecipient == null) return;

  if (suggestedIssuer === ownerId) {
    ocrData.isOwnerIssuer = true;
    if (suggestedRecipient) {
      ocrData.counterpartyId ??= suggestedRecipient;
    }
  } else if (suggestedRecipient === ownerId) {
    ocrData.isOwnerIssuer = false;
    if (suggestedIssuer) {
      ocrData.counterpartyId ??= suggestedIssuer;
    }
  } else if (suggestedIssuer != null && suggestedRecipient != null) {
    // Both sides matched to non-owner businesses — ambiguous which side the owner is.
    // Preserve the OCR-derived isOwnerIssuer and use it only to pick counterpartyId.
    if (ocrData.isOwnerIssuer === true) {
      ocrData.counterpartyId ??= suggestedRecipient;
    } else if (ocrData.isOwnerIssuer === false) {
      ocrData.counterpartyId ??= suggestedIssuer;
    }
  } else if (suggestedIssuer != null) {
    // Only issuer matched to a non-owner business → owner must be the recipient side
    ocrData.isOwnerIssuer = false;
    ocrData.counterpartyId ??= suggestedIssuer;
  } else if (suggestedRecipient != null) {
    // Only recipient matched to a non-owner business → owner must be the issuer side
    ocrData.isOwnerIssuer = true;
    ocrData.counterpartyId ??= suggestedRecipient;
  }
}

export async function getDocumentFromFile(
  injector: Injector,
  file: File | Blob,
  chargeId?: string | null,
  isSensitive?: boolean | null,
  counterPartyId?: string,
  hash?: number,
): Promise<IInsertDocumentsParams['documents'][number]> {
  try {
    const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

    // Buffer the file to allow multiple reads from a stream
    const buffer = await file.arrayBuffer();
    const multiReadableFile = new Blob([buffer], { type: file.type });

    const [{ fileUrl, imageUrl }, ocrData, fileHash] = await Promise.all([
      uploadToCloudinary(injector, multiReadableFile),
      getOcrData(injector, multiReadableFile, isSensitive),
      hash ? Promise.resolve(hash) : getHashFromFile(multiReadableFile),
    ]);

    if (!ocrData) {
      throw new Error('No data returned from Green Invoice');
    }

    if (counterPartyId) {
      ocrData.counterpartyId = counterPartyId;
    }

    // Resolve isOwnerIssuer and counterpartyId from UUID matches (primary path).
    resolveOwnerSideFromUuids(ocrData, ownerId);

    return getDocumentFromUrlsAndOcrData(fileUrl, imageUrl, ocrData, ownerId, chargeId, fileHash);
  } catch (e) {
    const message = 'Error extracting document data from file';
    console.error(`${message}: ${e}`);
    throw new Error(message, { cause: e });
  }
}
