import DataLoader from 'dataloader';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import {
  _DOLLAR_defs_addClientRequest_Input,
  _DOLLAR_defs_getClientResponse,
  _DOLLAR_defs_updateClientRequest_Input,
  init,
  updateClient_mutationMutationVariables,
  type Sdk,
} from '@accounter/green-invoice-graphql';
import type { Currency } from '@shared/enums';
import { dateToTimelessDateString, getCacheInstance } from '@shared/helpers';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '../../shared/types/index.js';

export type ExpenseDraft = NonNullable<
  Extract<
    Awaited<ReturnType<Sdk['searchExpenseDrafts_query']>>['searchExpenseDrafts'],
    { items: Array<unknown> }
  >['items'][number]
>;
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class GreenInvoiceClientProvider {
  localCurrency: Currency;
  cache = getCacheInstance({
    stdTTL: 60 * 5, // 5 minutes
  });

  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.Context,
    @Inject(ENVIRONMENT) private env: Environment,
  ) {
    this.localCurrency = this.context.adminContext.defaultLocalCurrency;
  }

  public authToken: string | null = null;

  private async init() {
    const id = this.env.greenInvoice?.id;
    const secret = this.env.greenInvoice?.secret;

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
      const message = 'Green Invoice SDK error';
      console.error(`${message}: ${e}`);
      throw new Error(message);
    }
  }

  /**
   * Expenses
   * */

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
            fromDate: dateToTimelessDateString(new Date()),
            toDate: dateToTimelessDateString(new Date()),
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
              expense.currency !== this.localCurrency ||
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

      console.log('Failed to fetch OCR data, returning empty draft');
      const emptyDraft = {
        expense: {
          documentType: '_405', // "receipt on donation" which is not supported, resulting in unprocessed document
          number: undefined,
          date: undefined,
          amount: 0,
          currency: this.localCurrency,
          vat: 0,
        },
      } as ExpenseDraft;
      return emptyDraft;
    } catch (e) {
      const message = 'Green Invoice Add Expense Draft error';
      console.error(`${message}: ${e}`);
      throw new Error(message);
    }
  }

  /**
   * Documents
   * */

  public async searchDocuments(...params: Parameters<Sdk['searchDocuments_query']>) {
    const sdk = await this.getSDK();
    return sdk.searchDocuments_query(...params).then(res => {
      for (const doc of res.searchDocuments?.items ?? []) {
        if (doc) this.cache.set(`document-${doc.id}`, doc);
      }

      return res.searchDocuments;
    });
  }

  public async addDocuments(...params: Parameters<Sdk['addDocument_mutation']>) {
    const sdk = await this.getSDK();
    return sdk.addDocument_mutation(...params).then(res => res.addDocument);
  }

  public async previewDocuments(...params: Parameters<Sdk['previewDocument_query']>) {
    const sdk = await this.getSDK();
    return sdk.previewDocument_query(...params).then(res => res.previewDocument);
  }

  public async getLinkedDocuments(documentId: string) {
    const sdk = await this.getSDK();
    return sdk.getLinkedDocuments_query({ id: documentId }).then(res => res.getLinkedDocuments);
  }

  private async _batchLoadByIds<T extends { id?: string | null }>(
    ids: readonly string[],
    fetcher: (sdk: Sdk, id: string) => Promise<T | null | undefined>,
    cachePrefix: string,
  ): Promise<(T | null)[]> {
    const sdk = await this.getSDK();
    const uniqueIds = Array.from(new Set(ids));
    const items: (T | undefined)[] = await Promise.all(
      uniqueIds.map(async id =>
        fetcher(sdk, id).then(item => {
          if (item?.id) {
            this.cache.set(`${cachePrefix}-${item.id}`, item);
          }
          return item ?? undefined;
        }),
      ),
    );

    const itemsMap = new Map(items.filter((i): i is T => !!i).map(i => [i.id, i]));
    return ids.map(id => itemsMap.get(id) ?? null);
  }

  private async batchDocumentsByIds(ids: readonly string[]) {
    return this._batchLoadByIds(
      ids,
      (sdk, id) => sdk.getDocument_query({ id }).then(res => res.getDocument),
      'document',
    );
  }

  public documentLoader = new DataLoader(
    (ids: readonly string[]) => this.batchDocumentsByIds(ids),
    {
      cacheKeyFn: id => `document-${id}`,
      cacheMap: this.cache,
    },
  );

  public async closeDocument(documentId: string) {
    this.invalidateDocument(documentId);
    const sdk = await this.getSDK();
    return sdk.closeDocument_mutation({ id: documentId }).then(res => res.closeDocument);
  }

  public async invalidateDocument(documentId: string) {
    this.cache.delete(`document-${documentId}`);
  }

  /**
   * Clients
   * */

  private async batchClientsByIds(ids: readonly string[]) {
    return this._batchLoadByIds(
      ids,
      (sdk, id) => sdk.getClient_query({ id }).then(res => res.getClient),
      'client',
    );
  }

  public clientLoader = new DataLoader((ids: readonly string[]) => this.batchClientsByIds(ids), {
    cacheKeyFn: id => `client-${id}`,
    cacheMap: this.cache,
  });

  public async createClient(
    input: _DOLLAR_defs_addClientRequest_Input,
  ): Promise<_DOLLAR_defs_getClientResponse> {
    try {
      const sdk = await this.getSDK();
      const client = await sdk.addClient_mutation({ input }).then(res => res.addClient);
      if (!client) {
        throw new Error('Failed to create Green Invoice client');
      }
      if ('errorMessage' in client) {
        throw new Error(`Failed to create Green Invoice client: ${client.errorMessage}`);
      }

      const { id } = client as _DOLLAR_defs_getClientResponse;
      this.cache.set(`client-${id}`, client);
      return client as _DOLLAR_defs_getClientResponse;
    } catch (error) {
      const message = 'Green Invoice Create Client error';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async updateClient(
    args: updateClient_mutationMutationVariables,
  ): Promise<_DOLLAR_defs_getClientResponse> {
    try {
      const sdk = await this.getSDK();
      const client = await sdk.updateClient_mutation(args).then(res => res.updateClient);
      if (!client) {
        throw new Error('Failed to update Green Invoice client');
      }
      if ('errorMessage' in client) {
        throw new Error(`Failed to update Green Invoice client: ${client.errorMessage}`);
      }

      const { id } = client as _DOLLAR_defs_getClientResponse;
      this.cache.set(`client-${id}`, client);
      return client as _DOLLAR_defs_getClientResponse;
    } catch (error) {
      this.invalidateClient(args.id);
      const message = 'Green Invoice Update Client error';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async deleteClient(clientId: string): Promise<_DOLLAR_defs_getClientResponse> {
    try {
      const sdk = await this.getSDK();
      const client = await sdk
        .deleteClient_mutation({ id: clientId })
        .then(res => res.deleteClient);
      if (!client) {
        throw new Error('Failed to delete Green Invoice client');
      }
      if ('errorMessage' in client) {
        throw new Error(`Failed to delete Green Invoice client: ${client.errorMessage}`);
      }

      this.invalidateClient(clientId);
      return client as _DOLLAR_defs_getClientResponse;
    } catch (error) {
      this.invalidateClient(clientId);
      const message = 'Green Invoice Delete Client error';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public invalidateClient(clientId: string) {
    this.cache.delete(`client-${clientId}`);
  }
}
