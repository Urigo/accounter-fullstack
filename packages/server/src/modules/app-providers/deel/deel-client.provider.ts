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
  PaymentReceipts,
  retrieveInvoicesSchema,
  retrievePaymentBreakdownSchema,
  retrievePaymentReceiptsSchema,
} from './schemas.js';

const DEEL_FETCH_TIMEOUT_MS = 30_000;
export const DEEL_MAX_ATTEMPTS = 3;
const DEEL_RETRY_BASE_DELAY_MS = 1000;
const DEEL_MAX_RETRY_DELAY_MS = 30_000;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);
const DEEL_INVOICES_PAGE_SIZE = 50;
const DEEL_INVOICES_MAX_PAGES = 40;
const DEEL_RECEIPTS_MAX_PAGES = 40;
const ERROR_BODY_MAX_LENGTH = 300;
const MAX_REPORTED_ISSUE_GROUPS = 10;
const MAX_REPORTED_VALUES = 5;
const REPORTED_VALUE_MAX_LENGTH = 60;

/** A Deel API call that failed, with the endpoint and the reason in its message */
export class DeelApiError extends Error {
  /** What failed, without the response body or the values Deel sent — safe to show the user */
  public readonly publicMessage: string;

  constructor(message: string, options?: ErrorOptions & { publicMessage?: string }) {
    super(message, options);
    this.name = 'DeelApiError';
    this.publicMessage = options?.publicMessage ?? message;
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Thrown inside a retried attempt to mark it as worth retrying */
class RetryableAttemptError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: string | null,
    options?: ErrorOptions,
  ) {
    super(message, options);
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

function formatReceivedValue(value: unknown): string {
  let text: string;
  try {
    text = value === undefined ? 'undefined' : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return truncate(text, REPORTED_VALUE_MAX_LENGTH);
}

/**
 * Describe schema violations one line per kind: array indexes are collapsed (`rows[*]`), so a field
 * that breaks in every row is reported once with a count and the values Deel actually sent — what
 * is needed to fix the schema when Deel adds a value.
 */
export function formatZodIssues(issues: readonly z.core.$ZodIssue[]): string {
  const groups = new Map<string, { count: number; values: Set<string> }>();
  for (const issue of issues) {
    const path = issue.path
      .map((part, index) =>
        typeof part === 'number' ? '[*]' : `${index === 0 ? '' : '.'}${String(part)}`,
      )
      .join('');
    const key = `${path || '(root)'}: ${issue.message}`;
    const group = groups.get(key) ?? { count: 0, values: new Set<string>() };
    group.count++;
    if ('input' in issue && group.values.size < MAX_REPORTED_VALUES) {
      group.values.add(formatReceivedValue(issue.input));
    }
    groups.set(key, group);
  }

  const lines = [...groups.entries()].slice(0, MAX_REPORTED_ISSUE_GROUPS).map(([key, group]) => {
    const count = group.count > 1 ? ` (${group.count}×)` : '';
    const values = group.values.size ? ` — received ${[...group.values].join(', ')}` : '';
    return `- ${key}${count}${values}`;
  });
  if (groups.size > MAX_REPORTED_ISSUE_GROUPS) {
    lines.push(`- …and ${groups.size - MAX_REPORTED_ISSUE_GROUPS} more`);
  }
  return lines.join('\n');
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

function describeHttpFailure(
  label: string,
  res: Response,
  body: string,
  sentToken: boolean,
): string {
  let message = `Deel API ${label} responded ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  // only a request that sent the token can be refused because of it (not e.g. a signed file URL)
  if (sentToken && (res.status === 401 || res.status === 403)) {
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
    // optional dates come as '' — keep them empty rather than turning them into "Invalid Date"
    if (!dateString) {
      return dateString;
    }
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
   * GET with a timeout, retrying network failures, timeouts (also while reading the body), 429 and
   * 5xx gateway errors. `read` consumes the body inside the attempt, so a body that stalls is
   * retried like a request that does. Any other failure is thrown as a DeelApiError naming the
   * endpoint, the status and the response body.
   */
  private async fetchWithRetry<T>(
    url: URL | string,
    label: string,
    options: { headers: Record<string, string>; read: (res: Response) => Promise<T> },
  ): Promise<T> {
    const sentToken = 'authorization' in options.headers;
    for (let attempt = 1; ; attempt++) {
      try {
        let res: Response;
        try {
          res = await fetch(url, {
            headers: options.headers,
            signal: AbortSignal.timeout(DEEL_FETCH_TIMEOUT_MS),
          });
        } catch (error) {
          const reason = isTimeout(error)
            ? `timed out after ${DEEL_FETCH_TIMEOUT_MS / 1000}s`
            : 'could not be reached';
          throw new RetryableAttemptError(reason, null, { cause: error });
        }

        if (!res.ok) {
          // on the last attempt fall through, so the error carries the response body
          if (RETRYABLE_STATUSES.has(res.status) && attempt < DEEL_MAX_ATTEMPTS) {
            await res.body?.cancel().catch(() => undefined);
            throw new RetryableAttemptError(
              `responded ${res.status}`,
              res.headers.get('retry-after'),
            );
          }
          const body = await res.text().catch(() => '');
          throw new DeelApiError(describeHttpFailure(label, res, body, sentToken), {
            publicMessage: describeHttpFailure(label, res, '', sentToken),
          });
        }

        try {
          return await options.read(res);
        } catch (error) {
          if (isTimeout(error)) {
            throw new RetryableAttemptError(
              `timed out after ${DEEL_FETCH_TIMEOUT_MS / 1000}s while reading the response`,
              null,
              { cause: error },
            );
          }
          throw error;
        }
      } catch (error) {
        if (!(error instanceof RetryableAttemptError)) {
          throw error;
        }
        if (attempt >= DEEL_MAX_ATTEMPTS) {
          throw new DeelApiError(`Deel API ${label} ${error.message} (${attempt} attempts)`, {
            cause: error.cause,
          });
        }
        await this.delay(getRetryDelayMs(attempt, error.retryAfter));
      }
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

    const rawData = await this.fetchWithRetry(url, label, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${await this.getApiToken()}`,
      },
      read: async res => {
        const text = await res.text();
        try {
          return JSON.parse(text) as unknown;
        } catch (error) {
          throw new DeelApiError(`Deel API ${label} returned a non-JSON response`, {
            cause: error,
          });
        }
      },
    });

    if (rawData && typeof rawData === 'object' && 'errors' in rawData) {
      throw new DeelApiError(
        `Deel API ${label} returned errors: ${formatDeelErrors(rawData.errors)}`,
      );
    }

    const parsed = schema.safeParse(rawData, { reportInput: true });
    if (!parsed.success) {
      throw new DeelApiError(
        `Deel API ${label} returned an unexpected payload:\n${formatZodIssues(parsed.error.issues)}`,
        { publicMessage: `Deel API ${label} returned an unexpected payload` },
      );
    }
    return parsed.data;
  }

  /** Payment receipts of the last year, following Deel's cursor through every page */
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

      const receipts = new Map<string, PaymentReceipts>();
      let cursor: string | undefined;
      for (let page = 0; page < DEEL_RECEIPTS_MAX_PAGES; page++) {
        const data = await this.request('/payments', retrievePaymentReceiptsSchema, {
          ...query,
          cursor,
        });
        const sizeBefore = receipts.size;
        for (const receipt of data.data.rows) {
          receipts.set(receipt.id, receipt);
        }

        if (!data.data.has_more || !data.data.next_cursor) {
          return [...receipts.values()];
        }
        if (receipts.size === sizeBefore) {
          // the cursor didn't move us forward — syncing a truncated list would file the invoices
          // of the missing receipts as unmatched, so refuse instead
          throw new Error(
            `Deel kept returning the same payment receipts after ${receipts.size}, so the rest of the list (${data.data.total_count ?? 'unknown'} in total) couldn't be fetched`,
          );
        }
        cursor = data.data.next_cursor;
      }

      throw new Error(
        `Deel has more than ${DEEL_RECEIPTS_MAX_PAGES} pages of payment receipts since ${query.date_from}; refusing to sync a truncated list`,
      );
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
      // keyed by id: offset paging over a live list may return a row twice when it shifts
      const invoices = new Map<string, Invoice>();
      const issuedFromDate = addYearsToTimelessDate(todayTimelessDate(), -1);

      let offset = 0;
      for (let page = 0; page < DEEL_INVOICES_MAX_PAGES; page++) {
        const data = await this.request('/invoices', retrieveInvoicesSchema, {
          limit: DEEL_INVOICES_PAGE_SIZE,
          offset,
          issued_from_date: issuedFromDate,
        });

        for (const invoice of data.data) {
          invoices.set(invoice.id, {
            ...invoice,
            issued_at: this.timeZoneFix(invoice.issued_at),
            due_date: this.timeZoneFix(invoice.due_date),
            // NOTE: contract ID -261 refers to "independent contractor", so we normalize it to null
            contract_id: invoice.contract_id === '-261' ? null : invoice.contract_id,
          });
        }

        // advance by what the page held, so a short page doesn't skip rows
        offset += data.data.length;
        if (data.data.length === 0 || offset >= data.page.total_rows) {
          return [...invoices.values()];
        }
      }

      throw new Error(
        `Deel has more than ${DEEL_INVOICES_MAX_PAGES} pages of invoices issued since ${issuedFromDate}; refusing to sync a truncated list`,
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
      const invoiceFileBuffer = await this.fetchWithRetry(data.data.url, 'invoice file download', {
        headers: {},
        read: res => res.arrayBuffer(),
      });
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
