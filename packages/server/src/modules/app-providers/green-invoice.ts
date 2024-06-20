import { format } from 'date-fns';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { init, type Sdk } from '@accounter/green-invoice-graphql';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';

export type ExpenseDraft = NonNullable<
  Extract<
    Awaited<ReturnType<Sdk['searchExpenseDrafts_query']>>['searchExpenseDrafts'],
    { items: Array<unknown> }
  >['items'][number]
>;
@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GreenInvoiceProvider {
  constructor(@Inject(ENVIRONMENT) private env: Environment) {}

  public authToken: string | null = null;

  private async init() {
    const id = this.env.greenInvoice.id;
    const secret = this.env.greenInvoice.secret;

    if (!id || !secret) {
      throw new Error('Environment variables not found');
    }

    const greenInvoice = await init(id, secret);

    return greenInvoice;
  }

  public async getSDK(): Promise<Sdk> {
    try {
      const { sdk, authToken } = await this.init();

      this.authToken = authToken;

      return sdk;
    } catch (e) {
      console.error(e);
      throw new Error(`Green Invoice error: ${(e as Error).message}`);
    }
  }

  public async addExpenseDraftByFile(file: File | Blob): Promise<ExpenseDraft> {
    try {
      // convert what-wg file to nodejs file
      const newFile = new File(
        [Buffer.from(await file.arrayBuffer())],
        'name' in file ? file.name : 'new-file',
        {
          type: file.type,
        },
      );

      // get file upload url + params
      const sdk = await this.getSDK();
      const { getFileUploadUrl: fileUploadParams } = await sdk.getFileUploadUrl_query({
        context: 'expense',
        data: { source: 5 },
      });

      if (!fileUploadParams) {
        throw new Error('No file upload params returned');
      }

      const form = new FormData();
      for (const [field, value] of Object.entries(fileUploadParams.fields)) {
        if (value) {
          // replace field names underscores with dashes (originally dashes, Mesh converted to underscores to match GraphQL spec)
          form.append(field.replaceAll('_', '-'), value as string);
        }
      }
      form.append('file', newFile, newFile.name);

      const uploadTime = new Date().getTime();

      // upload the file
      await fetch(fileUploadParams.url, {
        method: 'POST',
        body: form,
      }).then(async res => {
        if (![200, 201, 204].includes(res.status)) {
          throw new Error('Failed to upload file');
        }
        return;
      });

      // TODO: next section is temporary fix until decent webhook will be set up
      let retryCounter = 15; // 30 seconds
      while (retryCounter > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay to allow Green Invoice to process the file.

        const res = await sdk.searchExpenseDrafts_query({
          input: {
            fromDate: format(new Date(), 'yyyy-MM-dd'),
            toDate: format(new Date(), 'yyyy-MM-dd'),
          },
        });
        if (
          res.searchExpenseDrafts &&
          'items' in res.searchExpenseDrafts &&
          res.searchExpenseDrafts.items.length
        ) {
          const items = res.searchExpenseDrafts.items.filter(item => {
            return !!item && item?.creationDate > uploadTime / 1000;
          }) as ExpenseDraft[];
          if (items.length > 1) {
            // currently we cannot differentiate between drafts
            throw new Error('Multiple drafts found');
          }
          if (items.length === 1) {
            const { expense } = items[0];
            // check if any actual OCR fields exists
            if (
              expense.amount !== null ||
              expense.currency !== 'ILS' ||
              expense.date !== null ||
              expense.documentType !== '_20' ||
              expense.number !== null ||
              expense.vat !== 0
            ) {
              console.log(`Finally, it took only ${(15 - retryCounter) * 2} seconds...`);
              return items[0];
            }
          }
        }

        retryCounter -= 1;
      }

      throw new Error('Failed to find uploaded draft');
    } catch (e) {
      console.error(e);
      throw new Error(`Green Invoice error: ${(e as Error).message}`);
    }
  }

  public async searchDocuments(...params: Parameters<Sdk['searchDocuments_query']>) {
    const sdk = await this.getSDK();
    return sdk.searchDocuments_query(...params).then(res => res.searchDocuments);
  }
}
