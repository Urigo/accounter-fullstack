import { Inject, Injectable, Scope } from 'graphql-modules';
import { init, type Sdk } from '@accounter/green-invoice-graphql';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';

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

  public async addExpenseDraftByFile(file: File | Blob) {
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

      // upload the file
      const expenseDraft = await fetch(fileUploadParams.url, {
        method: 'POST',
        body: form,
      }).then(async res => {
        if (![200, 201, 204].includes(res.status)) {
          console.error(res);
          console.error(await res.text());
          throw new Error('Failed to upload file');
        }
        return;
      });

      // TODO: use webhook to get the result

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return expenseDraft as any;
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
