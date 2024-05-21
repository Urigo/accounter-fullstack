import type {
  addExpenseDraftByFile_mutationMutation,
  GetExpenseDraft,
} from '@accounter/green-invoice-graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { Currency } from '@shared/enums';
import { normalizeDocumentType } from '../helpers/green-invoice.helper.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type { DocumentsModule, IGetAllDocumentsResult, IInsertDocumentsParams } from '../types.js';

const toBase64 = async (file: File | Blob): Promise<string> => {
  const base64string = Buffer.from(await file.arrayBuffer()).toString('base64');
  return 'data:' + file.type + ';base64,' + base64string;
};

function isCurrency(value?: string | null): value is Currency {
  if (!value) {
    return false;
  }
  const keys = Object.keys(Currency).map(key => key.toUpperCase());
  return keys.includes(value);
}

export const uploadDocument: DocumentsModule.MutationResolvers['uploadDocument'] = async (
  _,
  { file, chargeId },
  { injector },
) => {
  try {
    const base64string = await toBase64(file).catch(err => {
      throw new Error(`Failed to convert file to base64: ${err.message}`);
    });

    const cloudinaryPromise = injector
      .get(CloudinaryProvider)
      .uploadInvoiceToCloudinary(base64string);
    const greenInvoicePromise = injector.get(GreenInvoiceProvider).addExpenseDraftByFile({
      input: { file: base64string },
    });

    const [{ fileUrl, imageUrl }, data] = await Promise.all([
      cloudinaryPromise,
      greenInvoicePromise,
    ]);

    if (!data.addExpenseDraftByFile) {
      throw new Error('No data returned from Green Invoice');
    }

    if (
      'errorMessage' in data.addExpenseDraftByFile ||
      'errorCode_' in data.addExpenseDraftByFile
    ) {
      // TODO: return this after fixing Green Invoice file upload
      // throw new Error(`Green Invoice Error: ${data.addExpenseDraftByFile.errorMessage}`);
    }

    const draft = data.addExpenseDraftByFile as GetExpenseDraft;

    const newDocument: IInsertDocumentsParams['document'][number] = {
      image: imageUrl ?? null,
      file: fileUrl ?? null,
      documentType: normalizeDocumentType(draft.expense?.documentType),
      serialNumber: draft.expense?.number ?? null,
      date: draft.expense?.date ? new Date(draft.expense.date) : null,
      amount: draft.expense?.amount ?? null,
      currencyCode: isCurrency(draft.expense?.currency) ? draft.expense!.currency : null,
      vat: draft.expense?.vat ?? null,
      chargeId: chargeId ?? null,
    };
    const res = await injector
      .get(DocumentsProvider)
      .insertDocuments({ document: [{ ...newDocument }] });
    return { document: res[0] as IGetAllDocumentsResult };
  } catch (e) {
    const message = (e as Error)?.message ?? 'Unknown error';
    return {
      __typename: 'CommonError',
      message: `Error uploading document: ${message}`,
    };
  }
};
