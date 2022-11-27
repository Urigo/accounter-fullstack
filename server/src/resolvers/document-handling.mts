import { IInsertDocumentsParams } from '../__generated__/documents.types.mjs';
import { Currency, Resolvers } from '../__generated__/types.mjs';
import { normalizeDocumentType } from '../helpers/green-invoice.mjs';
import { pool } from '../providers/db.mjs';
import { insertDocuments } from '../providers/documents.mjs';
import { GreenInvoice } from '../providers/green-invoice.mjs';

const toBase64 = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (!reader.result) {
        reject(new Error('No file data'));
      } else if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        const enc = new TextDecoder('utf-8');
        resolve(enc.decode(reader.result));
      }
    };
    reader.onerror = error => reject(error);
  });

function isCurrency(value?: string): value is Currency {
  if (!value) {
    return false;
  }
  const keys = Object.keys(Currency).map(key => key.toUpperCase());
  return keys.includes(value);
}

export const uploadDocument: NonNullable<Resolvers['Mutation']>['uploadDocument'] = async (_, { file, chargeId }) => {
  try {
    const stringifiedFile = await toBase64(file).catch(err => {
      throw new Error(`Failed to convert file to base64: ${err.message}`);
    });

    const data = await GreenInvoice.addExpenseDraftByFile_mutation({ input: { file: stringifiedFile } });

    console.log(`/n/n/n${JSON.stringify(data.addExpenseDraftByFile, null, 2)}/n/n/n`);

    if (!data.addExpenseDraftByFile) {
      throw new Error('No data returned from Green Invoice');
    }

    const newDocument: IInsertDocumentsParams['document']['0'] = {
      image: data.addExpenseDraftByFile.thumbnail ?? null,
      file: data.addExpenseDraftByFile.url,
      documentType: normalizeDocumentType(data.addExpenseDraftByFile.expense?.documentType),
      serialNumber: data.addExpenseDraftByFile.expense?.number ?? null,
      date: data.addExpenseDraftByFile.expense?.date ? new Date(data.addExpenseDraftByFile.expense.date) : null,
      amount: data.addExpenseDraftByFile.expense?.amount ?? null,
      currencyCode: isCurrency(data.addExpenseDraftByFile.expense?.currency)
        ? data.addExpenseDraftByFile.expense!.currency
        : null,
      vat: data.addExpenseDraftByFile.expense?.vat ?? null,
      chargeId: chargeId ?? null,
    };
    const res = await insertDocuments.run({ document: [{ ...newDocument }] }, pool);
    return { document: res[0] };
  } catch (e) {
    const message = (e as Error)?.message ?? 'Unknown error';
    return {
      __typename: 'CommonError',
      message: `Error uploading document: ${message}`,
    };
  }
};
