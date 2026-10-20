import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Environment } from '../../../../shared/types/index.js';
import type { ProviderCredentialsProvider } from '../../../provider-credentials/providers/provider-credentials.provider.js';
import { DEEL_MAX_ATTEMPTS, DeelClientProvider } from '../deel-client.provider.js';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const breakdownRow = {
  adjustment: '0.00',
  approve_date: '',
  approvers: '',
  bonus: '0.00',
  commissions: '0.00',
  contract_country: 'IL',
  contract_id: null,
  contract_start_date: '2025-01-01T00:00:00.000Z',
  contract_type: 'pay_as_you_go_time_based',
  contractor_email: 'jane@example.com',
  contractor_employee_name: 'Jane Doe',
  contractor_pic_url: null,
  contractor_unique_identifier: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  currency: 'USD',
  date: '2026-01-01T00:00:00.000Z',
  deductions: '0.00',
  expenses: '0.00',
  frequency: 'monthly',
  general_ledger_account: '',
  group_id: 'g1',
  invoice_id: 'inv-1',
  others: '0.00',
  overtime: '0.00',
  payment_currency: 'USD',
  payment_date: '2026-01-02T00:00:00.000Z',
  pro_rata: '0.00',
  processing_fee: '0.00',
  total: '100.00',
  total_payment_currency: '100.00',
  work: '100.00',
};

class TestDeelClientProvider extends DeelClientProvider {
  public delays: number[] = [];
  protected override delay(ms: number): Promise<void> {
    this.delays.push(ms);
    return Promise.resolve();
  }
}

describe('DeelClientProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let getDeelCredentials: ReturnType<typeof vi.fn>;
  let client: TestDeelClientProvider;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    getDeelCredentials = vi.fn(async () => ({ apiToken: 'secret-token' }));
    client = new TestDeelClientProvider({} as Environment, {
      getDeelCredentials,
    } as unknown as ProviderCredentialsProvider);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the PROVIDER_NOT_CONFIGURED error when no token is stored', async () => {
    getDeelCredentials.mockResolvedValue(null);

    const error = await client.getPaymentBreakdown('r1').catch(e => e);

    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token and a timeout signal', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [breakdownRow] }));

    const result = await client.getPaymentBreakdown('r1');

    expect(result.data).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://api.letsdeel.com/rest/v2/payments/r1/breakdown');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries a 429, honouring Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    await expect(client.getPaymentBreakdown('r1')).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.delays).toEqual([2000]);
  });

  it('gives up after the last retry, naming the endpoint and status', async () => {
    fetchMock.mockImplementation(async () => new Response('upstream down', { status: 503 }));

    const error = (await client.getPaymentBreakdown('r1').catch(e => e)) as Error;

    expect(fetchMock).toHaveBeenCalledTimes(DEEL_MAX_ATTEMPTS);
    expect(client.delays).toEqual([1000, 2000]);
    expect(error.message).toBe('Failed to fetch Deel payment breakdown for receipt [r1]');
    expect((error.cause as Error).message).toBe(
      'Deel API GET /payments/r1/breakdown responded 503: upstream down',
    );
  });

  it('does not retry a 401, and hints at the token', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"invalid token"}', { status: 401, statusText: 'Unauthorized' }),
    );

    const error = (await client.getPaymentBreakdown('r1').catch(e => e)) as Error;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const cause = (error.cause as Error).message;
    expect(cause).toContain('responded 401 Unauthorized');
    expect(cause).toContain('check the Deel API token');
    expect(cause).toContain('invalid token');
    expect(cause).not.toContain('secret-token');
  });

  it('reports a timeout once the retries run out', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

    const error = (await client.getPaymentBreakdown('r1').catch(e => e)) as Error;

    expect(fetchMock).toHaveBeenCalledTimes(DEEL_MAX_ATTEMPTS);
    expect((error.cause as Error).message).toBe(
      `Deel API GET /payments/r1/breakdown timed out after 30s (${DEEL_MAX_ATTEMPTS} attempts)`,
    );
  });

  it('lists where the payload broke the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ ...breakdownRow, bonus: '5.00' }] }));

    const error = (await client.getPaymentBreakdown('r1').catch(e => e)) as Error;

    const cause = (error.cause as Error).message;
    expect(cause).toContain('Deel API GET /payments/r1/breakdown returned an unexpected payload');
    expect(cause).toContain('data[0].bonus');
  });

  it("reports Deel's own error messages", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [{ message: 'Contract is archived' }] }));

    const error = (await client.getPaymentBreakdown('r1').catch(e => e)) as Error;

    expect((error.cause as Error).message).toContain('returned errors: Contract is archived');
  });

  it('refuses a truncated receipts list', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { rows: [], total: 0, next_cursor: 'abc', has_more: true, total_count: 120 },
      }),
    );

    const error = (await client.getPaymentReceipts().catch(e => e)) as Error;

    expect(error.message).toBe('Failed to fetch Deel payment receipts');
    expect((error.cause as Error).message).toContain('only 0 of 120 payment receipts');
  });

  describe('getSalaryInvoices', () => {
    it('stops paging once total_rows is reached', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ data: [], page: { total_rows: 0, items_per_page: 50, offset: 0 } }),
      );

      await expect(client.getSalaryInvoices()).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0] as [URL];
      expect(url.searchParams.get('limit')).toBe('50');
      expect(url.searchParams.get('offset')).toBe('0');
    });
  });
});
