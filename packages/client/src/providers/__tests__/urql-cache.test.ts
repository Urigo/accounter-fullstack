import { Client, fetchExchange, gql, type OperationResult } from 'urql';
import { describe, expect, it } from 'vitest';
import {
  AllChargesDocument,
  RefetchChargeForChargesTableDocument,
  UpdateChargeAccountantApprovalDocument,
  UpdateChargeDocument,
  type AllChargesQuery,
} from '../../gql/graphql.js';
import { chargesCacheExchange } from '../urql-cache.js';

// A real client with the cache in front of a scripted, request-recording `fetch`, so the tests
// assert on the requests actually sent. Responses carry `__typename` on every object, as the
// server's do: the cache asks for it everywhere.

function makeCharge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'charge-1',
    __typename: 'CommonCharge',
    minEventDate: '2024-01-01',
    minDebitDate: null,
    minDocumentsDate: null,
    maxDebitDate: null,
    maxEventDate: '2024-01-01',
    maxDocumentsDate: null,
    totalAmount: { __typename: 'FinancialAmount', raw: -100, currency: 'ILS' },
    vat: { __typename: 'FinancialAmount', raw: -15 },
    counterparty: { __typename: 'LtdFinancialEntity', name: 'Acme', id: 'business-1' },
    userDescription: null as string | null,
    tags: [{ __typename: 'Tag', id: 'tag-1', name: 'Office', namePath: null }],
    taxCategory: { __typename: 'TaxCategory', id: 'tax-1', name: 'Expenses' },
    metadata: {
      __typename: 'ChargeMetadata',
      transactionsCount: 1,
      documentsCount: 1,
      ledgerCount: 0,
      miscExpensesCount: 0,
      depreciationRecordsCount: 0,
    },
    accountantApproval: 'UNAPPROVED',
    validationData: { __typename: 'ValidationData', missingInfo: ['DESCRIPTION'] },
    ...overrides,
  };
}

/** The parts of a row that arrive later (`@defer`). Charge mutations do not return them. */
function withDeferredParts(charge: ReturnType<typeof makeCharge>) {
  return {
    ...charge,
    metadata: { ...charge.metadata, invalidLedger: 'VALID' },
    missingInfoSuggestions: {
      __typename: 'ChargeSuggestions',
      description: 'Suggested description',
      tags: [],
    },
  };
}

type Responder = (variables: Record<string, unknown>) => unknown;

function makeClient(operations: string[], responses: Record<string, Responder>): Client {
  const scriptedFetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      operationName: string;
      variables?: Record<string, unknown>;
    };
    operations.push(body.operationName);
    const payload = JSON.stringify({ data: responses[body.operationName]?.(body.variables ?? {}) });
    return {
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => payload,
      json: async () => JSON.parse(payload),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return new Client({
    url: 'http://localhost/graphql',
    exchanges: [chargesCacheExchange(), fetchExchange],
    fetch: scriptedFetch,
    preferGetMethod: false,
  });
}

const LIST_VARIABLES = { page: 0, limit: 100, filters: {} };

function listOf(...charges: unknown[]): Responder {
  return () => ({
    allCharges: {
      __typename: 'PaginatedCharges',
      nodes: charges,
      pageInfo: { __typename: 'PageInfo', totalPages: 1 },
    },
  });
}

/** The fields of a charge as a query result holds them, without the fragment-masking types. */
type LooseCharge = Record<string, unknown> & { __typename: string };

/**
 * Subscribes to the All Charges list as the screen does (always from the network) and keeps the
 * subscription open, so the cache can hand it the list again when a charge in it changes.
 */
async function followList(client: Client): Promise<{ latest: () => LooseCharge[] }> {
  let latest: OperationResult<AllChargesQuery> | undefined;
  client
    .query(AllChargesDocument, LIST_VARIABLES, { requestPolicy: 'network-only' })
    .subscribe(result => {
      latest = result;
    });
  await settle();
  return {
    latest: () => (latest?.data?.allCharges.nodes ?? []) as unknown as LooseCharge[],
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

describe('charges cache', () => {
  it("updates a listed charge from a mutation's result, without a request", async () => {
    const operations: string[] = [];
    const client = makeClient(operations, {
      AllCharges: listOf(withDeferredParts(makeCharge())),
      UpdateCharge: () => ({
        updateCharge: {
          __typename: 'UpdateChargeSuccessfulResult',
          charge: makeCharge({
            userDescription: 'Rent',
            validationData: { __typename: 'ValidationData', missingInfo: [] },
          }),
        },
      }),
    });
    const list = await followList(client);
    expect(list.latest()[0].userDescription).toBeNull();

    await client
      .mutation(UpdateChargeDocument, {
        chargeId: 'charge-1',
        fields: { userDescription: 'Rent' },
      })
      .toPromise();
    await settle();

    expect(list.latest()[0].userDescription).toBe('Rent');
    expect(list.latest()[0].validationData).toMatchObject({ missingInfo: [] });
    // The deferred parts were not in the mutation's result and keep what the list loaded.
    expect(list.latest()[0].metadata).toMatchObject({ invalidLedger: 'VALID' });
    expect(operations).toEqual(['AllCharges', 'UpdateCharge']);
  });

  it('writes a new accountant status onto the charge, from the arguments and the result', async () => {
    const operations: string[] = [];
    const client = makeClient(operations, {
      AllCharges: listOf(withDeferredParts(makeCharge())),
      UpdateChargeAccountantApproval: () => ({ updateChargeAccountantApproval: 'APPROVED' }),
    });
    const list = await followList(client);

    await client
      .mutation(UpdateChargeAccountantApprovalDocument, {
        chargeId: 'charge-1',
        status: 'APPROVED',
      })
      .toPromise();
    await settle();

    expect(list.latest()[0].accountantApproval).toBe('APPROVED');
    expect(operations).toEqual(['AllCharges', 'UpdateChargeAccountantApproval']);
  });

  it('answers a row read with a charge the list already loaded', async () => {
    const operations: string[] = [];
    const client = makeClient(operations, {
      AllCharges: listOf(withDeferredParts(makeCharge())),
      RefetchChargeForChargesTable: () => ({ charge: withDeferredParts(makeCharge()) }),
    });
    await followList(client);

    const read = await client
      .query(
        RefetchChargeForChargesTableDocument,
        { chargeId: 'charge-1' },
        { requestPolicy: 'cache-first' },
      )
      .toPromise();

    expect(read.data?.charge.id).toBe('charge-1');
    expect(operations).toEqual(['AllCharges']);

    // A refetch still goes to the server when asked to.
    await client
      .query(
        RefetchChargeForChargesTableDocument,
        { chargeId: 'charge-1' },
        { requestPolicy: 'network-only' },
      )
      .toPromise();
    expect(operations).toEqual(['AllCharges', 'RefetchChargeForChargesTable']);
  });

  it('asks the server for a row whose deferred parts it does not hold', async () => {
    // A charges table whose list did not go through the cache: all the cache has of the charge
    // is what a mutation returned.
    const operations: string[] = [];
    const client = makeClient(operations, {
      UpdateCharge: () => ({
        updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: makeCharge() },
      }),
      RefetchChargeForChargesTable: () => ({ charge: withDeferredParts(makeCharge()) }),
    });
    await client
      .mutation(UpdateChargeDocument, { chargeId: 'charge-1', fields: { userDescription: '' } })
      .toPromise();

    const results: OperationResult[] = [];
    client
      .query(
        RefetchChargeForChargesTableDocument,
        { chargeId: 'charge-1' },
        { requestPolicy: 'cache-first' },
      )
      .subscribe(result => results.push(result));
    await settle();

    expect(operations).toEqual(['UpdateCharge', 'RefetchChargeForChargesTable']);
    expect(
      (results.at(-1)?.data as { charge: LooseCharge } | undefined)?.charge.metadata,
    ).toMatchObject({ invalidLedger: 'VALID' });
  });

  it('keeps a charge in its list when an edit changes its concrete type', async () => {
    const operations: string[] = [];
    const client = makeClient(operations, {
      AllCharges: listOf(
        withDeferredParts(makeCharge()),
        withDeferredParts(makeCharge({ id: 'charge-2' })),
      ),
      // Setting a business trip turns the common charge into a business-trip charge.
      UpdateCharge: () => ({
        updateCharge: {
          __typename: 'UpdateChargeSuccessfulResult',
          charge: makeCharge({
            __typename: 'BusinessTripCharge',
            userDescription: 'Conference',
            businessTrip: { __typename: 'BusinessTrip', id: 'trip-1', name: 'Berlin' },
          }),
        },
      }),
      RefetchChargeForChargesTable: () => ({
        charge: withDeferredParts(
          makeCharge({
            __typename: 'BusinessTripCharge',
            userDescription: 'Conference',
            businessTrip: { __typename: 'BusinessTrip', id: 'trip-1', name: 'Berlin' },
          }),
        ),
      }),
    });
    const list = await followList(client);

    await client
      .mutation(UpdateChargeDocument, {
        chargeId: 'charge-1',
        fields: { businessTripID: 'trip-1' },
      })
      .toPromise();
    // The edit form refetches the row afterwards, which brings the deferred parts for the new type.
    await client
      .query(
        RefetchChargeForChargesTableDocument,
        { chargeId: 'charge-1' },
        { requestPolicy: 'network-only' },
      )
      .toPromise();
    await settle();

    expect(list.latest().map(charge => [charge.id, charge.__typename])).toEqual([
      ['charge-1', 'BusinessTripCharge'],
      ['charge-2', 'CommonCharge'],
    ]);
    expect(list.latest()[0].userDescription).toBe('Conference');
    expect(list.latest()[0].businessTrip).toMatchObject({ name: 'Berlin' });
    expect(operations).toEqual(['AllCharges', 'UpdateCharge', 'RefetchChargeForChargesTable']);
  });

  it('sends each operation once', async () => {
    const operations: string[] = [];
    const client = makeClient(operations, {
      UpdateCharge: () => ({
        updateCharge: { __typename: 'UpdateChargeSuccessfulResult', charge: makeCharge() },
      }),
      UpdateChargeAccountantApproval: () => ({ updateChargeAccountantApproval: 'APPROVED' }),
    });

    await client
      .mutation(UpdateChargeDocument, { chargeId: 'charge-1', fields: { userDescription: '' } })
      .toPromise();
    await client
      .mutation(UpdateChargeAccountantApprovalDocument, {
        chargeId: 'charge-1',
        status: 'APPROVED',
      })
      .toPromise();

    expect(operations).toEqual(['UpdateCharge', 'UpdateChargeAccountantApproval']);
  });

  it('leaves every other operation uncached', async () => {
    const SomeListQuery = gql`
      query SomeList {
        allTags {
          id
          name
        }
      }
    `;
    const SomeMutation = gql`
      mutation SomeMutation {
        addTag(name: "x")
      }
    `;
    const operations: string[] = [];
    const client = makeClient(operations, {
      SomeList: () => ({ allTags: [{ id: 'tag-1', name: 'Office' }] }),
      SomeMutation: () => ({ addTag: true }),
    });

    const first = await client.query(SomeListQuery, {}).toPromise();
    const second = await client.query(SomeListQuery, {}).toPromise();
    const mutated = await client.mutation(SomeMutation, {}).toPromise();

    // Not cached: the same query goes to the network again, as it always has. The response
    // reaches the caller as sent, with no `__typename` asked for on its behalf.
    expect(first.data).toEqual({ allTags: [{ id: 'tag-1', name: 'Office' }] });
    expect(second.data).toEqual(first.data);
    expect(mutated.data).toEqual({ addTag: true });
    expect(operations).toEqual(['SomeList', 'SomeList', 'SomeMutation']);
  });

  it('starts empty for every new client', async () => {
    // What keeps one user's or business scope's charges from reaching the next: a reset builds a
    // new client, and with it a new cache.
    const firstOperations: string[] = [];
    const first = makeClient(firstOperations, {
      AllCharges: listOf(withDeferredParts(makeCharge())),
    });
    await followList(first);

    const secondOperations: string[] = [];
    const second = makeClient(secondOperations, {
      RefetchChargeForChargesTable: () => ({ charge: withDeferredParts(makeCharge()) }),
    });
    await second
      .query(
        RefetchChargeForChargesTableDocument,
        { chargeId: 'charge-1' },
        { requestPolicy: 'cache-first' },
      )
      .toPromise();

    expect(secondOperations).toEqual(['RefetchChargeForChargesTable']);
  });
});
