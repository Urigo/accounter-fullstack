import type { Injector } from 'graphql-modules';
import { AnthropicProvider } from '@modules/app-providers/anthropic.js';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { hashStringToInt } from '../../../shared/helpers/index.js';
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
    throw new Error(message);
  }
};

export type OcrData = {
  isOwnerIssuer: boolean | null;
  counterpartyId: string | null;
  documentType: DocumentType;
  serial: string | null;
  date: Date | null;
  amount: number | null;
  currency: Currency | null;
  vat: number | null;
  allocationNumber: string | null;
};

export async function getOcrData(
  injector: Injector,
  file: File | Blob,
  isSensitive: boolean | null = true,
): Promise<OcrData> {
  const validateNumber = (value: unknown): number | null => {
    return typeof value === 'number' && !Number.isNaN(value) ? value : null;
  };

  const validateDate = (value: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  if (isSensitive) {
    return {
      isOwnerIssuer: null,
      counterpartyId: null,
      documentType: DocumentType.Unprocessed,
      serial: null,
      date: null,
      amount: null,
      currency: null,
      vat: null,
      allocationNumber: null,
    };
  }

  const draft = await injector.get(AnthropicProvider).extractInvoiceDetails(file);

  if (!draft) {
    throw new Error('No data returned from Anthropic OCR');
  }

  let isOwnerIssuer: boolean | null = null;
  if (draft.recipient?.toLocaleLowerCase().includes('the guild')) {
    isOwnerIssuer = false;
  }
  if (draft.issuer?.toLocaleLowerCase().includes('the guild')) {
    isOwnerIssuer = true;
  }

  return {
    isOwnerIssuer,
    counterpartyId: null,
    documentType: draft.type ?? DocumentType.Unprocessed,
    serial: draft.referenceCode,
    date: validateDate(draft.date),
    amount: validateNumber(draft.fullAmount),
    currency: draft.currency,
    vat: validateNumber(draft.vatAmount),
    allocationNumber: draft.allocationNumber ?? null,
  };
}

async function getHashFromFile(file: File | Blob): Promise<number> {
  return hashStringToInt(await file.text());
}

function figureOutSides(
  documentType: DocumentType,
  isOwnerIssuer: boolean | null,
  defaultAdminBusinessId: string,
  counterPartyId: string | null,
): { creditorId: string | null; debtorId: string | null } {
  if (documentType === DocumentType.Unprocessed || documentType === DocumentType.Other) {
    return { creditorId: null, debtorId: null };
  }

  let res: {
    creditorId: string | null;
    debtorId: string | null;
  } = {
    creditorId: counterPartyId,
    debtorId: defaultAdminBusinessId,
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
): IInsertDocumentsParams['document'][number] {
  const sides = figureOutSides(
    ocrData.documentType,
    ocrData.isOwnerIssuer,
    adminBusinessId,
    ocrData.counterpartyId,
  );

  const newDocument: IInsertDocumentsParams['document'][number] = {
    image: imageUrl ?? null,
    file: fileUrl ?? null,
    documentType: ocrData.documentType,
    serialNumber: ocrData.serial,
    date: ocrData.date,
    amount: ocrData.amount,
    currencyCode: ocrData.currency,
    vat: ocrData.vat,
    chargeId: chargeId ?? null,
    vatReportDateOverride: null,
    noVatAmount: null,
    allocationNumber: ocrData.allocationNumber,
    exchangeRateOverride: null,
    fileHash: fileHash?.toString() ?? null,
    ...sides,
  };

  return newDocument;
}

export async function getDocumentFromFile(
  context: GraphQLModules.ModuleContext,
  file: File | Blob,
  chargeId?: string | null,
  isSensitive?: boolean | null,
): Promise<IInsertDocumentsParams['document'][number]> {
  try {
    const {
      injector,
      // adminContext: { defaultAdminBusinessId },
    } = context;
    // Buffer the file to allow multiple reads from a stream
    const buffer = await file.arrayBuffer();
    const multiReadableFile = new Blob([buffer], { type: file.type });

    const [{ fileUrl, imageUrl }, ocrData, hash] = await Promise.all([
      uploadToCloudinary(injector, multiReadableFile),
      getOcrData(injector, multiReadableFile, isSensitive),
      getHashFromFile(multiReadableFile),
    ]);

    if (!ocrData) {
      throw new Error('No data returned from Green Invoice');
    }

    return getDocumentFromUrlsAndOcrData(
      fileUrl,
      imageUrl,
      ocrData,
      context.adminContext.defaultAdminBusinessId,
      chargeId,
      hash,
    );
  } catch (e) {
    const message = 'Error extracting document data from file';
    console.error(`${message}: ${e}`);
    throw new Error(message);
  }
}
