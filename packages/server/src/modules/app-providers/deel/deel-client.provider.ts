import { addHours } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import z from 'zod';
import { Currency } from '../../../shared/enums.js';
import { addYearsToTimelessDate, todayTimelessDate } from '../../../shared/helpers/index.js';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment, TimelessDateString } from '../../../shared/types/index.js';
import { ProviderCredentialsProvider } from '../../provider-credentials/providers/provider-credentials.provider.js';
import {
  ContractSchema,
  downloadInvoicePdfSchema,
  Invoice,
  retrieveInvoicesSchema,
  retrievePaymentBreakdownSchema,
  retrievePaymentReceiptsSchema,
} from './schemas.js';

export const DEEL_FETCH_TIMEOUT_MS = 30_000;
export const DEEL_MAX_ATTEMPTS = 3;
const DEEL_RETRY_BASE_DELAY_MS = 1000;
const DEEL_MAX_RETRY_DELAY_MS = 30_000;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);
export const DEEL_INVOICES_PAGE_SIZE = 50;
export const DEEL_INVOICES_MAX_PAGES = 40;
const ERROR_BODY_MAX_LENGTH = 300;

/** A Deel API call that failed, with the endpoint and the reason in its message */
export class DeelApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DeelApiError';
  }
}

function truncate(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine;
}

function formatDeelErrors(errors: unknown): string {
  if (Array.isArray(errors)) {
    const messages = errors
      .map(error =>
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : JSON.stringify(error),
      )
      .filter(Boolean);
    if (messages.length) {
      return messages.join('; ');
    }
  }
  return truncate(JSON.stringify(errors), ERROR_BODY_MAX_LENGTH);
}

/** Retry delay: the server's `Retry-After` when given, exponential backoff otherwise */
function getRetryDelayMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : new Date(retryAfter).getTime() - Date.now();
    if (Number.isFinite(delay) && delay >= 0) {
      return Math.min(delay, DEEL_MAX_RETRY_DELAY_MS);
    }
  }
  return Math.min(DEEL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), DEEL_MAX_RETRY_DELAY_MS);
}

function describeHttpFailure(label: string, res: Response, body: string): string {
  let message = `Deel API ${label} responded ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  if (res.status === 401 || res.status === 403) {
    message += ' — check the Deel API token in the provider integrations settings';
  }
  const details = truncate(body, ERROR_BODY_MAX_LENGTH);
  return details ? `${message}: ${details}` : message;
}

/** Keeps a provider's own GraphQLError (e.g. PROVIDER_NOT_CONFIGURED) and wraps anything else */
function wrapError(message: string, error: unknown): Error {
  if (error instanceof GraphQLError) {
    return error;
  }
  return new Error(message, { cause: error });
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DeelClientProvider {
  private host = 'https://api.letsdeel.com/rest/v2';
  private tokenPromise: Promise<string> | null = null;

  constructor(
    @Inject(ENVIRONMENT) private env: Environment,
    private credentialsProvider: ProviderCredentialsProvider,
  ) {}

  // This is a workaround for the Deel API returning PST dates as UTC dates.
  private timeZoneFix(dateString: string) {
    const date = new Date(dateString);
    return addHours(date, 7).toUTCString();
  }

  private getApiToken(): Promise<string> {
    this.tokenPromise ??= this._fetchToken().catch(error => {
      this.tokenPromise = null;
      throw error;
    });
    return this.tokenPromise;
  }

  private async _fetchToken(): Promise<string> {
    const fromDb = await this.credentialsProvider.getDeelCredentials();
    const token = fromDb?.apiToken ?? null;

    if (!token) {
      throw new GraphQLError('Deel credentials not configured for this tenant', {
        extensions: { code: 'PROVIDER_NOT_CONFIGURED' },
      });
    }

    return token;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET with a timeout, retrying network failures, timeouts, 429 and 5xx gateway errors. Any other
   * failure is thrown as a DeelApiError naming the endpoint, the status and the response body.
   */
  private async fetchWithRetry(
    url: URL | string,
    label: string,
    headers: Record<string, string>,
  ): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(DEEL_FETCH_TIMEOUT_MS),
        });
      } catch (error) {
        if (attempt < DEEL_MAX_ATTEMPTS) {
          await this.delay(getRetryDelayMs(attempt));
          continue;
        }
        const timedOut =
          error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        const reason = timedOut
          ? `timed out after ${DEEL_FETCH_TIMEOUT_MS / 1000}s`
          : 'could not be reached';
        throw new DeelApiError(`Deel API ${label} ${reason} (${attempt} attempts)`, undefined, {
          cause: error,
        });
      }

      if (res.ok) {
        return res;
      }

      if (RETRYABLE_STATUSES.has(res.status) && attempt < DEEL_MAX_ATTEMPTS) {
        await res.body?.cancel().catch(() => undefined);
        await this.delay(getRetryDelayMs(attempt, res.headers.get('retry-after')));
        continue;
      }

      const body = await res.text().catch(() => '');
      throw new DeelApiError(describeHttpFailure(label, res, body), res.status);
    }
  }

  private async request<S extends z.ZodType>(
    endpoint: string,
    schema: S,
    query: Record<string, string | number | undefined> = {},
  ): Promise<z.output<S>> {
    const url = new URL(`${this.host}${endpoint}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    const label = `GET ${endpoint}${url.search}`;

    const res = await this.fetchWithRetry(url, label, {
      accept: 'application/json',
      authorization: `Bearer ${await this.getApiToken()}`,
    });

    let rawData: unknown;
    try {
      rawData = await res.json();
    } catch (error) {
      throw new DeelApiError(`Deel API ${label} returned a non-JSON response`, res.status, {
        cause: error,
      });
    }

    if (rawData && typeof rawData === 'object' && 'errors' in rawData) {
      throw new DeelApiError(
        `Deel API ${label} returned errors: ${formatDeelErrors(rawData.errors)}`,
        res.status,
      );
    }

    const parsed = schema.safeParse(rawData);
    if (!parsed.success) {
      throw new DeelApiError(
        `Deel API ${label} returned an unexpected payload:\n${z.prettifyError(parsed.error)}`,
        res.status,
      );
    }
    return parsed.data;
  }

  public async getPaymentReceipts() {
    try {
      const query: {
        date_from: TimelessDateString;
        date_to: TimelessDateString;
        currencies?: Currency;
        entities?: 'company' | 'individual';
      } = {
        date_from: addYearsToTimelessDate(todayTimelessDate(), -1),
        date_to: todayTimelessDate(),
      };
      const data = await this.request('/payments', retrievePaymentReceiptsSchema, query);

      if (data.data.has_more) {
        // The cursor parameter of this endpoint is undocumented. Syncing a truncated list would
        // file the invoices of the missing receipts as unmatched, so refuse instead.
        throw new Error(
          `Deel returned only ${data.data.rows.length} of ${data.data.total_count ?? 'more'} payment receipts since ${query.date_from}, and paging through the rest is not supported yet`,
        );
      }

      return data;
    } catch (error) {
      throw wrapError('Failed to fetch Deel payment receipts', error);
    }
  }

  public async getPaymentBreakdown(paymentId: string) {
    try {
      return await this.request(
        `/payments/${encodeURIComponent(paymentId)}/breakdown`,
        retrievePaymentBreakdownSchema,
      );
    } catch (error) {
      throw wrapError(`Failed to fetch Deel payment breakdown for receipt [${paymentId}]`, error);
    }
  }

  public async getSalaryInvoices(): Promise<Invoice[]> {
    try {
      const invoices: Invoice[] = [];
      const issuedFromDate = addYearsToTimelessDate(todayTimelessDate(), -1);

      for (let page = 0; page < DEEL_INVOICES_MAX_PAGES; page++) {
        const offset = page * DEEL_INVOICES_PAGE_SIZE;
        const data = await this.request('/invoices', retrieveInvoicesSchema, {
          limit: DEEL_INVOICES_PAGE_SIZE,
          offset,
          issued_from_date: issuedFromDate,
        });

        invoices.push(
          ...data.data.map(invoice => ({
            ...invoice,
            issued_at: this.timeZoneFix(invoice.issued_at),
            due_date: this.timeZoneFix(invoice.due_date),
            // NOTE: contract ID -261 refers to "independent contractor", so we normalize it to null
            contract_id: invoice.contract_id === '-261' ? null : invoice.contract_id,
          })),
        );

        if (data.data.length === 0 || offset + data.data.length >= data.page.total_rows) {
          return invoices;
        }
      }

      throw new Error(
        `Deel has more than ${DEEL_INVOICES_MAX_PAGES * DEEL_INVOICES_PAGE_SIZE} invoices issued since ${issuedFromDate}; refusing to sync a truncated list`,
      );
    } catch (error) {
      throw wrapError('Failed to fetch Deel salary invoices', error);
    }
  }

  public async getSalaryInvoiceFile(id: string) {
    try {
      const data = await this.request(
        `/invoices/${encodeURIComponent(id)}/download`,
        downloadInvoicePdfSchema,
      );

      if (!data.data.url) {
        throw new Error('Deel invoice file download URL is missing');
      }

      // The signed URL carries its own credentials — keep it out of error messages
      const invoiceFileRes = await this.fetchWithRetry(data.data.url, 'invoice file download', {});
      const invoiceFileBuffer = await invoiceFileRes.arrayBuffer();
      return new Blob([invoiceFileBuffer], { type: 'application/pdf' });
    } catch (error) {
      throw wrapError(`Failed to fetch Deel invoice file [${id}]`, error);
    }
  }

  public async getContractDetails(contractId: string) {
    try {
      return await this.request(`/contracts/${encodeURIComponent(contractId)}`, ContractSchema);
    } catch (error) {
      throw wrapError(`Failed to fetch Deel contract details [${contractId}]`, error);
    }
  }
}
