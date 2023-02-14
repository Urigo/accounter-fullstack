import { GetExpenseDraft } from '@accounter-toolkit/green-invoice-graphql';
import {
  IGetAllDocumentsResult,
  IInsertDocumentsParams,
} from '../../../__generated__/documents.types.js';
import { normalizeDocumentType } from '../../../helpers/green-invoice.js';
import { Currency } from '../../../models/enums.js';
import { uploadInvoiceToCloudinary } from '../../../providers/cloudinary.js';
import { pool } from '../../../providers/db.js';
import { insertDocuments } from '../../../providers/documents.js';
import { GreenInvoice } from '../../../providers/green-invoice.js';
import { DocumentsModule } from '../__generated__/types.js';

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
) => {
  try {
    const base64string = await toBase64(file).catch(err => {
      throw new Error(`Failed to convert file to base64: ${err.message}`);
    });

    const { fileUrl, imageUrl } = await uploadInvoiceToCloudinary(base64string);

    const data = await GreenInvoice.addExpenseDraftByFile_mutation({
      input: { file: base64string },
    });

    if (!data.addExpenseDraftByFile) {
      throw new Error('No data returned from Green Invoice');
    }

    if (
      'errorMessage' in data.addExpenseDraftByFile ||
      'errorCode_' in data.addExpenseDraftByFile
    ) {
      throw new Error(`Green Invoice Error: ${data.addExpenseDraftByFile.errorMessage}`);
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
    const res = await insertDocuments.run({ document: [{ ...newDocument }] }, pool);
    return { document: res[0] as IGetAllDocumentsResult };
  } catch (e) {
    const message = (e as Error)?.message ?? 'Unknown error';
    return {
      __typename: 'CommonError',
      message: `Error uploading document: ${message}`,
    };
  }
};
