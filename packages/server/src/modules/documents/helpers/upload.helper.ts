import type { Injector } from 'graphql-modules';
import { AnthropicProvider } from '@modules/app-providers/anthropic.js';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { Currency, DocumentType } from '@shared/enums';
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

type OcrData = {
  isOwnerCreditor: boolean;
  counterpartyId: string | null;
  documentType: DocumentType;
  serial: string | null;
  date: Date | null;
  amount: number | null;
  currency: Currency | null;
  vat: number | null;
};

export async function getOcrData(
  injector: Injector,
  file: File | Blob,
  _isSensitive: boolean = true,
): Promise<OcrData> {
  const draft = await injector.get(AnthropicProvider).extractInvoiceDetails(file);

  if (!draft) {
    throw new Error('No data returned from Green Invoice');
  }

  const isOwnerCreditor = (draft.fullAmount ?? 0) > 0 && draft.type !== DocumentType.CreditInvoice;

  return {
    isOwnerCreditor,
    counterpartyId: null,
    documentType: draft.type ?? DocumentType.Unprocessed,
    serial: draft.referenceCode,
    date: draft.date ? new Date(draft.date) : null,
    amount: draft.fullAmount,
    currency: draft.currency,
    vat: draft.vatAmount,
  };
}

export async function getDocumentFromFile(
  context: GraphQLModules.ModuleContext,
  file: File | Blob,
  chargeId?: string | null,
  isSensitive?: boolean,
): Promise<IInsertDocumentsParams['document'][number]> {
  try {
    const {
      injector,
      adminContext: { defaultAdminBusinessId },
    } = context;
    const [{ fileUrl, imageUrl }, ocrData] = await Promise.all([
      uploadToCloudinary(injector, file),
      getOcrData(injector, file, isSensitive),
    ]);

    if (!ocrData) {
      throw new Error('No data returned from Green Invoice');
    }

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
      creditorId: ocrData.isOwnerCreditor ? ocrData.counterpartyId : defaultAdminBusinessId,
      debtorId: ocrData.isOwnerCreditor ? defaultAdminBusinessId : ocrData.counterpartyId,
    };

    return newDocument;
  } catch (e) {
    const message = 'Error extracting document data from file';
    console.error(`${message}: ${e}`);
    throw new Error(message);
  }
}
