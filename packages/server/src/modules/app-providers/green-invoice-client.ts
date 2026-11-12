import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { CONTEXT, Inject, Injectable, Optional, Scope } from 'graphql-modules';
import {
  _DOLLAR_defs_addClientRequest_Input,
  _DOLLAR_defs_getClientResponse,
  _DOLLAR_defs_updateClientRequest_Input,
  createGreenInvoiceSdk,
  updateClient_mutationMutationVariables,
  type Sdk,
} from '@accounter/green-invoice-graphql';
import { log, markLogged, scrubText, wasLogged, type LogFields } from '../../observability/log.js';
import { todayTimelessDate } from '../../shared/helpers/index.js';
import { ENVIRONMENT } from '../../shared/tokens.js';
import type { Environment } from '../../shared/types/index.js';
import { AdminContextProvider } from '../admin-context/providers/admin-context.provider.js';
import { ProviderCredentialsProvider } from '../provider-credentials/providers/provider-credentials.provider.js';
import { GreenInvoiceTokenCacheProvider } from './green-invoice-token-cache.js';

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
  private initPromise: Promise<Sdk> | null = null;

  constructor(
    private adminContextProvider: AdminContextProvider,
    @Inject(ENVIRONMENT) private env: Environment,
    private credentialsProvider: ProviderCredentialsProvider,
    private tokenCache: GreenInvoiceTokenCacheProvider,
    // Optional: absent when the provider is built directly (tests, scripts).
    @Optional() @Inject(CONTEXT) private requestContext?: GraphQLModules.GlobalContext,
  ) {}

  /** Logs a failed call with the operation and request it belongs to; see {@link failure}. */
  private fail(
    message: string,
    greenInvoiceCall: string,
    error: unknown,
    fields?: LogFields,
  ): Error {
    const requestLog = this.requestContext?.requestLog;
    return failure(message, greenInvoiceCall, error, {
      ...fields,
      operationName: requestLog?.operationName ?? null,
      requestId: requestLog?.requestId ?? null,
    });
  }

  private init(): Promise<Sdk> {
    this.initPromise ??= this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<Sdk> {
    // Read before the credentials: if they are removed or replaced (which evicts the key) after this
    // point, the SDK sees a newer epoch and stops using the shared cache, so the old key can't put
    // its token back. Credential writes commit before evicting, so a later read sees the new state.
    const epoch = this.tokenCache.epoch;
    const fromDb = await this.credentialsProvider.getGreenInvoiceCredentials();
    const creds = fromDb ?? null;

    if (!creds) {
      throw new GraphQLError('Green Invoice credentials not configured for this tenant', {
        extensions: { code: 'PROVIDER_NOT_CONFIGURED' },
      });
    }

    // the access token comes from the app-wide cache on each call, so it is reused across operations
    return createGreenInvoiceSdk({
      id: creds.id,
      secret: creds.secret,
      tokenCache: this.tokenCache,
      epoch,
    });
  }

  public async getSDK(): Promise<Sdk> {
    try {
      return await this.init();
    } catch (e) {
      throw this.fail('Green Invoice SDK error', 'init', e);
    }
  }

  /**
   * Expenses
   * */

  public async addExpenseDraftByFile(file: File | Blob): Promise<ExpenseDraft> {
    try {
      const { defaultLocalCurrency } = await this.adminContextProvider.getVerifiedAdminContext();
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
            fromDate: todayTimelessDate(),
            toDate: todayTimelessDate(),
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
              expense.currency !== defaultLocalCurrency ||
              expense.date !== null ||
              expense.documentType !== '_20' ||
              expense.number !== null ||
              expense.vat !== 0
            ) {
              log('info', 'green-invoice-expense-draft-ready', {
                waitedSeconds: (15 - retryCounter) * 2,
              });
              return items[0];
            }
          }
        }

        retryCounter -= 1;
      }

      log('warn', 'green-invoice-expense-draft-timeout', { detail: 'returning an empty draft' });
      const emptyDraft = {
        expense: {
          documentType: '_405', // "receipt on donation" which is not supported, resulting in unprocessed document
          number: null,
          date: null,
          amount: 0,
          currency: defaultLocalCurrency,
          vat: 0,
        },
      } as ExpenseDraft;
      return emptyDraft;
    } catch (e) {
      throw this.fail('Green Invoice Add Expense Draft error', 'addExpenseDraftByFile', e);
    }
  }

  /**
   * Documents
   * */

  public async searchDocuments(...params: Parameters<Sdk['searchDocuments_query']>) {
    const sdk = await this.getSDK();
    return sdk.searchDocuments_query(...params).then(res => {
      for (const doc of res.searchDocuments?.items ?? []) {
        if (doc) this.documentLoader.prime(doc.id, doc);
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

  public async getDocumentLinks(documentId: string) {
    const sdk = await this.getSDK();
    return sdk
      .getDocumentsDownloadLinks_query({ id: documentId })
      .then(res => res.getDocumentsDownloadLinks);
  }

  private async _batchLoadByIds<T extends { id?: string | null }>(
    ids: readonly string[],
    fetcher: (sdk: Sdk, id: string) => Promise<T | null | undefined>,
    primingFunction: (item: T) => void,
  ): Promise<(T | null)[]> {
    const sdk = await this.getSDK();
    const uniqueIds = Array.from(new Set(ids));
    const items: (T | undefined)[] = await Promise.all(
      uniqueIds.map(async id =>
        fetcher(sdk, id).then(item => {
          if (item?.id) {
            primingFunction(item);
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
      item => this.documentLoader.prime(item.id!, item),
    );
  }

  public documentLoader = new DataLoader((ids: readonly string[]) => this.batchDocumentsByIds(ids));

  public async closeDocument(documentId: string) {
    this.invalidateDocument(documentId);
    const sdk = await this.getSDK();
    return sdk.closeDocument_mutation({ id: documentId }).then(res => res.closeDocument);
  }

  public invalidateDocument(documentId: string) {
    this.documentLoader.clear(documentId);
  }

  /**
   * Clients
   * */

  private async batchClientsByIds(ids: readonly string[]) {
    return this._batchLoadByIds(
      ids,
      (sdk, id) => sdk.getClient_query({ id }).then(res => res.getClient),
      item => this.clientLoader.prime(item.id!, item),
    );
  }

  public clientLoader = new DataLoader((ids: readonly string[]) => this.batchClientsByIds(ids));

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
      if (id) {
        this.clientLoader.prime(id, client);
      }
      return client as _DOLLAR_defs_getClientResponse;
    } catch (error) {
      throw this.fail('Green Invoice Create Client error', 'createClient', error);
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
      if (id) {
        this.clientLoader.prime(id, client);
      }
      return client as _DOLLAR_defs_getClientResponse;
    } catch (error) {
      this.invalidateClient(args.id);
      throw this.fail('Green Invoice Update Client error', 'updateClient', error, {
        greenInvoiceClientId: args.id,
      });
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
      throw this.fail('Green Invoice Delete Client error', 'deleteClient', error, {
        greenInvoiceClientId: clientId,
      });
    }
  }

  public invalidateClient(clientId: string) {
    this.clientLoader.clear(clientId);
  }
}

/** What Green Invoice said about a failed call. Never the response body, which can echo client data. */
export type UpstreamErrorDetails = {
  /** HTTP status of the upstream response. */
  status: number | null;
  /** Green Invoice's own `errorCode`. */
  upstreamCode: number | string | null;
  /**
   * Green Invoice's own `errorMessage`, which says why it rejected the call. Cleaned: it can echo the
   * client's data, so digit runs (tax ids, phone numbers), emails and credentials are masked, and it
   * is capped at 200 characters. Both the log line and the message thrown to the user carry it.
   */
  upstreamMessage: string | null;
};

const MAX_UPSTREAM_MESSAGE_LENGTH = 200;

/** See {@link UpstreamErrorDetails.upstreamMessage}. */
export function cleanUpstreamMessage(message: string): string {
  const cleaned = scrubText(message).replaceAll(/\d{5,}/g, '[number]');
  return cleaned.length > MAX_UPSTREAM_MESSAGE_LENGTH
    ? `${cleaned.slice(0, MAX_UPSTREAM_MESSAGE_LENGTH)}…`
    : cleaned;
}

/**
 * Finds the upstream response behind an SDK error: the REST transport puts it on the GraphQL error's
 * `extensions.response`, and the SDK throws several errors as an `AggregateError`. Follows `cause`, so
 * it also works on an error this provider already wrapped.
 */
export function upstreamErrorDetails(error: unknown, depth = 0): UpstreamErrorDetails | null {
  if (typeof error !== 'object' || error === null || depth > 4) {
    return null;
  }
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      const found = upstreamErrorDetails(inner, depth + 1);
      if (found) {
        return found;
      }
    }
  }
  const response = (error as { extensions?: { response?: { status?: unknown; body?: unknown } } })
    .extensions?.response;
  if (response) {
    const body =
      typeof response.body === 'object' && response.body !== null
        ? (response.body as { errorCode?: unknown; errorMessage?: unknown })
        : {};
    return {
      status: typeof response.status === 'number' ? response.status : null,
      upstreamCode:
        typeof body.errorCode === 'number' || typeof body.errorCode === 'string'
          ? body.errorCode
          : null,
      upstreamMessage:
        typeof body.errorMessage === 'string' ? cleanUpstreamMessage(body.errorMessage) : null,
    };
  }
  return upstreamErrorDetails((error as { cause?: unknown }).cause, depth + 1);
}

/**
 * Logs a failed Green Invoice call with the upstream reason, and returns the error to throw.
 *
 * Logged here, not only at the GraphQL boundary: callers such as `updateClient` turn the error into a
 * `CommonError`, so it may never reach it, and only this site has the upstream response. The thrown
 * message carries the reason too, so a `CommonError` built from it tells the user why. An error that
 * already went through here (`getSDK` failing inside `updateClient`) is rethrown as is, so one
 * failure is one line.
 */
function failure(
  message: string,
  greenInvoiceCall: string,
  error: unknown,
  fields?: LogFields,
): Error {
  if (error instanceof Error && wasLogged(error)) {
    return error;
  }
  const upstream = upstreamErrorDetails(error);
  log('error', 'green-invoice-call-failed', {
    // Not `operation`: easy to mistake for the GraphQL `operationName` this line also carries.
    greenInvoiceCall,
    ...fields,
    ...upstream,
    message: error instanceof Error ? error.message : String(error),
  });
  const reason = upstream?.upstreamMessage ?? (error instanceof Error ? error.message : undefined);
  const wrapped = new Error(reason ? `${message}: ${reason}` : message, { cause: error });
  markLogged(wrapped);
  return wrapped;
}
