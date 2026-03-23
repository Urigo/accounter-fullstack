import { Injectable, Scope } from 'graphql-modules';
import { resolveCredentials } from '../../workspace-settings/helpers/credential-resolver.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../db.provider.js';

export interface PriorityCredentials {
  url: string;
  username: string;
  password: string;
}

export interface ODataListResponse<T> {
  value: T[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

export interface PriorityInvoiceRaw {
  IVNUM: string;
  IVTYPE?: string;
  CUSTNAME?: string;
  CUST_VATID?: string;
  CURDATE?: string;
  DUEDATE?: string;
  DETAILS?: string;
  CURRENCY?: string;
  QPRICE?: number;
  VAT?: number;
  TOTPRICE?: number;
  DISCOUNT?: number;
  PAID?: number;
  BALANCE?: number;
  STATDES?: string;
  [key: string]: unknown;
}

export interface ODataQueryOptions {
  $filter?: string;
  $select?: string;
  $expand?: string;
  $top?: number;
  $skip?: number;
  $orderby?: string;
  $count?: boolean;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class PriorityClientProvider {
  private cachedCredentials: PriorityCredentials | null | undefined = undefined;

  constructor(
    private authContextProvider: AuthContextProvider,
    private dbProvider: DBProvider,
  ) {}

  private async resolveOwnerId(): Promise<string> {
    const auth = await this.authContextProvider.getAuthContext();
    if (!auth?.tenant?.businessId) {
      throw new Error('Priority client: authentication required');
    }
    return auth.tenant.businessId;
  }

  async getCredentials(): Promise<PriorityCredentials | null> {
    if (this.cachedCredentials !== undefined) {
      return this.cachedCredentials;
    }
    const ownerId = await this.resolveOwnerId();
    const resolved = await resolveCredentials(ownerId, 'priority', this.dbProvider.pool);
    if (!resolved) {
      this.cachedCredentials = null;
      return null;
    }
    const { url, username, password } = resolved.credentials;
    if (!url || !username || !password) {
      this.cachedCredentials = null;
      return null;
    }
    this.cachedCredentials = { url, username, password };
    return this.cachedCredentials;
  }

  private buildAuthHeader(credentials: PriorityCredentials): string {
    return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
  }

  private buildServiceRoot(credentials: PriorityCredentials): string {
    return credentials.url.replace(/\/$/, '');
  }

  private applyQueryOptions(url: URL, options: ODataQueryOptions): void {
    if (options.$filter) url.searchParams.set('$filter', options.$filter);
    if (options.$select) url.searchParams.set('$select', options.$select);
    if (options.$expand) url.searchParams.set('$expand', options.$expand);
    if (options.$top !== undefined) url.searchParams.set('$top', String(options.$top));
    if (options.$skip) url.searchParams.set('$skip', String(options.$skip));
    if (options.$orderby) url.searchParams.set('$orderby', options.$orderby);
    if (options.$count) url.searchParams.set('$count', 'true');
    // Do NOT add $format=json — Priority uses the Accept header for content negotiation
  }

  private async fetchEntity<T>(
    credentials: PriorityCredentials,
    entity: string,
    options: ODataQueryOptions = {},
  ): Promise<ODataListResponse<T>> {
    const url = new URL(`${this.buildServiceRoot(credentials)}/${entity}`);
    this.applyQueryOptions(url, options);
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: this.buildAuthHeader(credentials),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let message = `Priority API error ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { '@odata.error'?: { message?: { value?: string } } };
        const detail = parsed['@odata.error']?.message?.value;
        if (detail) message += `: ${detail}`;
      } catch {
        if (body) message += `: ${body.slice(0, 200)}`;
      }
      throw new Error(message);
    }
    return res.json() as Promise<ODataListResponse<T>>;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      return { ok: false, message: 'Priority credentials not configured' };
    }
    try {
      const url = new URL(`${this.buildServiceRoot(credentials)}/$metadata`);
      const res = await fetch(url.toString(), {
        headers: { Authorization: this.buildAuthHeader(credentials) },
      });
      if (res.ok) return { ok: true, message: 'Connection successful' };
      const body = await res.text().catch(() => '');
      return { ok: false, message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async getInvoices(options: ODataQueryOptions = {}): Promise<PriorityInvoiceRaw[]> {
    const credentials = await this.getCredentials();
    if (!credentials) throw new Error('Priority credentials not configured');

    const all: PriorityInvoiceRaw[] = [];
    const pageSize = options.$top ?? 200;

    // First page — use the provided options with $top
    let data = await this.fetchEntity<PriorityInvoiceRaw>(credentials, 'AINVOICES', {
      ...options,
      $top: pageSize,
      $skip: undefined,
    });
    all.push(...data.value);

    // Follow nextLink for subsequent pages (Priority pagination)
    let nextLink = data['@odata.nextLink'];
    for (let page = 1; page < 50 && nextLink; page++) {
      const res = await fetch(nextLink, {
        headers: {
          Accept: 'application/json',
          Authorization: this.buildAuthHeader(credentials),
        },
      });
      if (!res.ok) break;
      data = (await res.json()) as ODataListResponse<PriorityInvoiceRaw>;
      all.push(...data.value);
      nextLink = data['@odata.nextLink'];
    }

    return all;
  }
}
