import { GetExpenseDraft } from '@accounter-toolkit/green-invoice-graphql';

import { IInsertDocumentsParams } from '../__generated__/documents.types.mjs';
import { Currency, Resolvers } from '../__generated__/types.mjs';
import { normalizeDocumentType } from '../helpers/green-invoice.mjs';
import { pool } from '../providers/db.mjs';
import { insertDocuments } from '../providers/documents.mjs';
import { GreenInvoice } from '../providers/green-invoice.mjs';

const toBase64 = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    file
      .text()
      .then(resolve)
      .catch(e => reject(e));
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

    if ('errorMessage' in data.addExpenseDraftByFile || 'errorCode_' in data.addExpenseDraftByFile) {
      throw new Error(`Green Invoice Error: ${data.addExpenseDraftByFile.errorMessage}`);
    }

    const draft = data.addExpenseDraftByFile as GetExpenseDraft;

    const newDocument: IInsertDocumentsParams['document']['0'] = {
      image: draft.thumbnail ?? null,
      file: draft.url,
      documentType: normalizeDocumentType(draft.expense?.documentType),
      serialNumber: draft.expense?.number ?? null,
      date: draft.expense?.date ? new Date(draft.expense.date) : null,
      amount: draft.expense?.amount ?? null,
      currencyCode: isCurrency(draft.expense?.currency) ? draft.expense!.currency : null,
      vat: draft.expense?.vat ?? null,
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
