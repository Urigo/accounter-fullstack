import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Environment } from '../../../../shared/types/index.js';
import type { ProviderCredentialsProvider } from '../../../provider-credentials/providers/provider-credentials.provider.js';
import z from 'zod';
import { DEEL_MAX_ATTEMPTS, DeelClientProvider, formatZodIssues } from '../deel-client.provider.js';
import { paymentReceiptsSchema } from '../schemas.js';

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
    expect(cause).toContain('- data[*].bonus: Invalid input: expected "0.00" — received "5.00"');
  });

  it("reports Deel's own error messages", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [{ message: 'Contract is archived' }] }));

    const error = (await client.getPaymentBreakdown('r1').catch(e => e)) as Error;

    expect((error.cause as Error).message).toContain('returned errors: Contract is archived');
  });

  it('does not hint at the token for the signed file URL', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { url: 'https://files.example/signed' } }))
      .mockResolvedValueOnce(new Response('expired', { status: 403, statusText: 'Forbidden' }));

    const error = (await client.getSalaryInvoiceFile('inv-1').catch(e => e)) as Error;

    const cause = (error.cause as Error).message;
    expect(cause).toContain('Deel API invoice file download responded 403 Forbidden: expired');
    expect(cause).not.toContain('API token');
    // the signed URL was fetched without the bearer token
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.headers).toEqual({});
  });

  it('retries a body that stalls past the timeout', async () => {
    const stalled = new Response(null, { status: 200 });
    vi.spyOn(stalled, 'text').mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );
    fetchMock
      .mockResolvedValueOnce(stalled)
      .mockResolvedValueOnce(jsonResponse({ data: [breakdownRow] }));

    await expect(client.getPaymentBreakdown('r1')).resolves.toMatchObject({
      data: [expect.objectContaining({ invoice_id: 'inv-1' })],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe('getPaymentReceipts', () => {
    type Page = {
      rows: Array<{ id: string }>;
      next_cursor: string | null;
      has_more: boolean | null;
      total_count: number | null;
    };
    function mockPages(...pages: Page[]) {
      const request = vi.spyOn(
        client as unknown as { request: (...args: unknown[]) => Promise<unknown> },
        'request',
      );
      for (const page of pages) {
        request.mockResolvedValueOnce({ data: { ...page, total: page.rows.length } });
      }
      return request;
    }

    it('follows next_cursor through every page', async () => {
      const request = mockPages(
        { rows: [{ id: 'r1' }, { id: 'r2' }], next_cursor: 'c2', has_more: true, total_count: 3 },
        { rows: [{ id: 'r3' }], next_cursor: null, has_more: false, total_count: 3 },
      );

      const receipts = await client.getPaymentReceipts();

      expect(receipts.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
      expect((request.mock.calls[0][2] as { cursor?: string }).cursor).toBeUndefined();
      expect((request.mock.calls[1][2] as { cursor?: string }).cursor).toBe('c2');
    });

    it('refuses to go on when the cursor brings nothing new', async () => {
      mockPages(
        { rows: [{ id: 'r1' }], next_cursor: 'c2', has_more: true, total_count: 120 },
        { rows: [{ id: 'r1' }], next_cursor: 'c2', has_more: true, total_count: 120 },
      );

      const error = (await client.getPaymentReceipts().catch(e => e)) as Error;

      expect(error.message).toBe('Failed to fetch Deel payment receipts');
      expect((error.cause as Error).message).toContain(
        'Deel kept returning the same payment receipts after 1',
      );
    });
  });

  describe('getSalaryInvoices', () => {
    function invoice(id: string, overrides: Record<string, unknown> = {}) {
      return {
        id,
        amount: '100.00',
        billing_type: 'WORK',
        contract_id: 'c1',
        created_at: '2026-01-01T00:00:00.000Z',
        currency: 'USD',
        deel_fee: '0.00',
        document_type: 'INVOICE',
        due_date: '2026-01-20T00:00:00.000Z',
        is_overdue: false,
        issued_at: '2026-01-05T10:00:00.000Z',
        label: `L-${id}`,
        paid_at: '',
        status: 'paid',
        total: '100.00',
        vat_id: '',
        vat_percentage: '',
        vat_total: '0.00',
        recipient_legal_entity_id: '1dee10b1-105b-4dc7-bcdb-5ed5c52ba868',
        ...overrides,
      };
    }
    function page(ids: string[], totalRows: number) {
      return jsonResponse({
        data: ids.map(id => invoice(id)),
        page: { total_rows: totalRows, items_per_page: 50, offset: 0 },
      });
    }
    function requestedOffsets() {
      return (fetchMock.mock.calls as Array<[URL]>).map(([url]) => url.searchParams.get('offset'));
    }

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

    it('advances by the rows each page held, so a short page skips nothing', async () => {
      const ids = Array.from({ length: 60 }, (_, i) => `i${i}`);
      fetchMock
        .mockResolvedValueOnce(page(ids.slice(0, 20), 60))
        .mockResolvedValueOnce(page(ids.slice(20, 50), 60))
        .mockResolvedValueOnce(page(ids.slice(50), 60));

      const invoices = await client.getSalaryInvoices();

      expect(requestedOffsets()).toEqual(['0', '20', '50']);
      expect(invoices.map(i => i.id)).toEqual(ids);
    });

    it('drops an invoice repeated across pages', async () => {
      fetchMock.mockResolvedValueOnce(page(['a', 'b'], 3)).mockResolvedValueOnce(page(['b', 'c'], 3));

      const invoices = await client.getSalaryInvoices();

      expect(invoices.map(i => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('refuses a list longer than the page cap', async () => {
      let n = 0;
      fetchMock.mockImplementation(async () => page([`i${n++}`], 1_000_000));

      const error = (await client.getSalaryInvoices().catch(e => e)) as Error;

      expect(error.message).toBe('Failed to fetch Deel salary invoices');
      expect((error.cause as Error).message).toContain('refusing to sync a truncated list');
      expect(fetchMock).toHaveBeenCalledTimes(40);
    });

    it('normalizes the independent-contractor contract and keeps an empty due date empty', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: [invoice('a', { contract_id: '-261', due_date: '' })],
          page: { total_rows: 1, items_per_page: 50, offset: 0 },
        }),
      );

      const [invoice_] = await client.getSalaryInvoices();

      expect(invoice_.contract_id).toBeNull();
      expect(invoice_.due_date).toBe('');
      expect(invoice_.issued_at).toBe('Mon, 05 Jan 2026 17:00:00 GMT');
    });
  });
});

describe('formatZodIssues', () => {
  const schema = z.object({
    rows: z.array(z.object({ kind: z.enum(['a', 'b']), amount: z.string() })),
  });

  it('reports a field broken in every row once, with a count and the received values', () => {
    const result = schema.safeParse(
      {
        rows: [
          { kind: 'new_kind', amount: '1' },
          { kind: 'new_kind', amount: '2' },
          { kind: 'other', amount: 3 },
        ],
      },
      { reportInput: true },
    );
    expect(result.success).toBe(false);

    const message = formatZodIssues(result.error!.issues);

    expect(message.split('\n')).toEqual([
      '- rows[*].kind: Invalid option: expected one of "a"|"b" (3×) — received "new_kind", "other"',
      '- rows[*].amount: Invalid input: expected string, received number — received 3',
    ]);
  });

  it('caps the number of reported kinds', () => {
    const wide = z.object(
      Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, z.string()])),
    );
    const result = wide.safeParse({}, { reportInput: true });

    const lines = formatZodIssues(result.error!.issues).split('\n');

    expect(lines).toHaveLength(11);
    expect(lines.at(-1)).toBe('- …and 2 more');
  });
});

describe('paymentReceiptsSchema', () => {
  it('accepts a payment method type Deel added after the schema was written', () => {
    expect(
      paymentReceiptsSchema.shape.payment_method.safeParse({ type: 'some_new_method' }).success,
    ).toBe(true);
  });
});
