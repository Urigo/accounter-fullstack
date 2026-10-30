import { describe, expect, it } from 'vitest';
import { createContractTool } from '../contracts-write.js';
import { authContext, B1, B2, BIZ, callsTo, mutationClient, runTool } from './review-write-harness.js';

const K1 = 'ff000000-0000-4000-8000-000000000001';
const SIGNED = 'https://example.sharepoint.com/:b:/g/personal/someone/order-form';

const created = (overrides: Record<string, unknown> = {}) => ({
  id: K1,
  ownerId: B1,
  isActive: true,
  startDate: '2027-01-01',
  endDate: '2028-12-31',
  billingCycle: 'ANNUAL',
  documentType: 'PROFORMA',
  product: 'HIVE',
  plan: 'ENTERPRISE',
  purchaseOrders: ['PO-1001'],
  remarks: 'Two-year order form; billed annually in advance.',
  msCloud: SIGNED,
  operationsLimit: 500000000,
  amount: { raw: 24000, currency: 'USD' },
  client: { id: BIZ, originalBusiness: { id: BIZ, name: 'Acme Learning Ltd.' } },
  ...overrides,
});

const minimal = {
  clientId: BIZ,
  startDate: '2027-01-01',
  endDate: '2028-12-31',
  amount: { value: 24000, currency: 'USD' },
  billingCycle: 'ANNUAL',
  documentType: 'PROFORMA',
};

describe('createContractTool — request', () => {
  it('sends one mutation with the input mapped field for field', async () => {
    const { client, captured } = mutationClient({
      contractsByClient: [{ id: 'k-old', isActive: true }],
      createContract: created(),
    });
    const result = await runTool(
      createContractTool,
      {
        ...minimal,
        product: 'HIVE',
        plan: 'ENTERPRISE',
        purchaseOrders: ['PO-1001'],
        remarks: 'Two-year order form; billed annually in advance.',
        msCloud: SIGNED,
        operationsLimit: 500000000,
        deactivateContractIds: ['k-old'],
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    // The deactivation pre-read, then the one mutation.
    expect(captured).toHaveLength(2);
    expect(callsTo(captured, 'contractsByClient')[0].variables).toEqual({ clientId: BIZ });
    const [call] = callsTo(captured, 'createContract');
    expect(call.query).toMatch(/^\s*mutation\b/);
    expect(call.variables).toEqual({
      input: {
        clientId: BIZ,
        startDate: '2027-01-01',
        endDate: '2028-12-31',
        amount: { raw: 24000, currency: 'USD' },
        billingCycle: 'ANNUAL',
        documentType: 'PROFORMA',
        isActive: true,
        purchaseOrders: ['PO-1001'],
        product: 'HIVE',
        plan: 'ENTERPRISE',
        remarks: 'Two-year order form; billed annually in advance.',
        msCloud: SIGNED,
        operationsLimit: 500000000,
        deactivateContracts: ['k-old'],
      },
    });
    expect(call.headers['x-business-scope']).toBe(B1);
  });

  it('always sends the non-null upstream fields: isActive defaults to true, purchaseOrders to []', async () => {
    const { client, captured } = mutationClient('createContract', created());
    await runTool(createContractTool, minimal, client);

    // No deactivation requested, so no pre-read either: one call.
    expect(captured).toHaveLength(1);

    const [call] = callsTo(captured, 'createContract');
    expect(call.variables).toEqual({
      input: {
        clientId: BIZ,
        startDate: '2027-01-01',
        endDate: '2028-12-31',
        amount: { raw: 24000, currency: 'USD' },
        billingCycle: 'ANNUAL',
        documentType: 'PROFORMA',
        isActive: true,
        purchaseOrders: [],
      },
    });
  });

  it('passes isActive: false through', async () => {
    const { client, captured } = mutationClient('createContract', created({ isActive: false }));
    await runTool(createContractTool, { ...minimal, isActive: false }, client);

    const [call] = callsTo(captured, 'createContract');
    expect((call.variables.input as { isActive: boolean }).isActive).toBe(false);
  });
});

describe('createContractTool — guards', () => {
  it.each([
    ['billingCycle', { billingCycle: 'QUARTERLY' }],
    ['documentType', { documentType: 'QUOTE' }],
    ['product', { product: 'GATEWAY' }],
    ['plan', { plan: 'TEAM' }],
    ['amount.currency', { amount: { value: 1, currency: 'CHF' } }],
    ['startDate', { startDate: '2026-02-31' }],
    ['endDate', { endDate: '2026/12/31' }],
    ['operationsLimit', { operationsLimit: -1 }],
    ['amount.value', { amount: { value: 0, currency: 'USD' } }],
    ['msCloud', { msCloud: 'not a url' }],
  ])('rejects a bad %s before any round trip', async (path, override) => {
    const { client, captured } = mutationClient('createContract', created());
    const result = await runTool(createContractTool, { ...minimal, ...override }, client);

    expect(result.isError, path).toBe(true);
    const structured = result.structuredContent as { code: string; issues?: Array<{ path: string }> };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.issues?.[0]?.path).toBe(path);
    expect(captured).toHaveLength(0);
  });

  it('refuses a negative fee as well as a zero one', async () => {
    const { client, captured } = mutationClient('createContract', created());
    const result = await runTool(
      createContractTool,
      { ...minimal, amount: { value: -100, currency: 'USD' } },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('refuses deactivateContractIds that are not the client’s own contracts, before the mutation', async () => {
    const { client, captured } = mutationClient({
      contractsByClient: [{ id: 'k-old', isActive: true }],
      createContract: created(),
    });
    const result = await runTool(
      createContractTool,
      { ...minimal, deactivateContractIds: ['k-old', 'k-someone-elses'] },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toContain('k-someone-elses');
    expect(structured.message).not.toContain('k-old,');
    expect(structured.issues).toHaveLength(1);
    expect(structured.issues[0].path).toBe('deactivateContractIds');
    expect(callsTo(captured, 'contractsByClient')).toHaveLength(1);
    expect(callsTo(captured, 'createContract')).toHaveLength(0);
  });

  it('lets deactivateContractIds through when every id belongs to the client', async () => {
    const { client, captured } = mutationClient({
      contractsByClient: [
        { id: 'k-old', isActive: true },
        { id: 'k-older', isActive: false },
      ],
      createContract: created(),
    });
    const result = await runTool(
      createContractTool,
      { ...minimal, deactivateContractIds: ['k-old', 'k-older'] },
      client,
    );

    expect(result.isError).toBeUndefined();
    const [call] = callsTo(captured, 'createContract');
    expect((call.variables.input as { deactivateContracts: string[] }).deactivateContracts).toEqual([
      'k-old',
      'k-older',
    ]);
  });

  it('refuses an end date before the start date', async () => {
    const { client, captured } = mutationClient('createContract', created());
    const result = await runTool(
      createContractTool,
      { ...minimal, startDate: '2027-01-01', endDate: '2026-10-31' },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.issues[0].path).toBe('endDate');
    expect(captured).toHaveLength(0);
  });

  it('accepts a one-day term (end equal to start)', async () => {
    const { client, captured } = mutationClient('createContract', created());
    const result = await runTool(
      createContractTool,
      { ...minimal, startDate: '2027-01-01', endDate: '2027-01-01' },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = mutationClient('createContract', created());
    const result = await runTool(createContractTool, minimal, client, authContext([B1, B2]));

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('createContractTool — result mapping', () => {
  it('echoes the contract in the get_contracts row shape and names what it deactivated', async () => {
    const { client } = mutationClient({
      contractsByClient: [{ id: 'k-old', isActive: true }],
      createContract: created(),
    });
    const result = await runTool(
      createContractTool,
      { ...minimal, product: 'HIVE', plan: 'ENTERPRISE', deactivateContractIds: ['k-old'] },
      client,
    );

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      contractId: string;
      clientBusinessId: string;
      deactivatedContractIds: string[];
      setFields: string[];
      contracts: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('create_contract');
    expect(structured.contractId).toBe(K1);
    expect(structured.clientBusinessId).toBe(BIZ);
    expect(structured.deactivatedContractIds).toEqual(['k-old']);
    expect(structured.setFields).toEqual([
      'clientId',
      'startDate',
      'endDate',
      'amount',
      'billingCycle',
      'documentType',
      'isActive',
      'purchaseOrders',
      'product',
      'plan',
      'deactivateContracts',
    ]);
    expect(structured.contracts).toEqual([
      {
        id: K1,
        ownerId: B1,
        client: { id: BIZ, businessId: BIZ, name: 'Acme Learning Ltd.' },
        isActive: true,
        startDate: '2027-01-01',
        endDate: '2028-12-31',
        billingCycle: 'ANNUAL',
        documentType: 'PROFORMA',
        product: 'HIVE',
        plan: 'ENTERPRISE',
        purchaseOrders: ['PO-1001'],
        remarks: 'Two-year order form; billed annually in advance.',
        msCloud: SIGNED,
        operationsLimit: 500000000,
        amount: { value: 24000, currency: 'USD' },
      },
    ]);
    expect(result.content[0]?.text).toContain('deactivated 1 previous contract');
  });

  it('reads a BigInt operations limit that arrived as a string, and nulls for optional fields', async () => {
    const { client } = mutationClient(
      'createContract',
      created({ operationsLimit: '500000000', product: null, plan: null, remarks: null, msCloud: null }),
    );
    const result = await runTool(createContractTool, minimal, client);

    const structured = result.structuredContent as {
      deactivatedContractIds: string[];
      contracts: Array<Record<string, unknown>>;
    };
    expect(structured.deactivatedContractIds).toEqual([]);
    expect(structured.contracts[0]).toMatchObject({
      operationsLimit: 500000000,
      product: null,
      plan: null,
      remarks: null,
      msCloud: null,
    });
  });

  it('surfaces an upstream GraphQL error as a non-retryable upstream error', async () => {
    const { client } = mutationClient('createContract', created(), 400);
    const result = await runTool(createContractTool, minimal, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
  });
});
