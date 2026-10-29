import { gql, type Client } from 'urql';
import { describe, expect, it } from 'vitest';
import { Store } from '@urql/exchange-graphcache';
import { CHARGE_TYPENAMES, cacheKeys, cacheOptions } from '../providers/urql-cache.js';
import { makeScriptedClient, type ScriptedResponse } from './helpers/scripted-client.js';

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

const ChargesListQuery = gql`
  query CacheTestChargesList {
    allCharges {
      nodes {
        id
        __typename
        userDescription
        ... on BusinessTripCharge {
          businessTrip {
            id
            name
          }
        }
        metadata {
          transactionsCount
        }
      }
      pageInfo {
        totalPages
      }
    }
  }
`;

const ChargeQuery = gql`
  query CacheTestCharge($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      __typename
      userDescription
      ... on BusinessTripCharge {
        businessTrip {
          id
          name
        }
      }
      metadata {
        transactionsCount
      }
    }
  }
`;

const UpdateChargeMutation = gql`
  mutation CacheTestUpdateCharge($chargeId: UUID!, $fields: UpdateChargeInput!) {
    updateCharge(chargeId: $chargeId, fields: $fields) {
      ... on UpdateChargeSuccessfulResult {
        charge {
          id
          __typename
          userDescription
          ... on BusinessTripCharge {
            businessTrip {
              id
              name
            }
          }
          metadata {
            transactionsCount
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

const DeleteChargeMutation = gql`
  mutation CacheTestDeleteCharge($chargeId: UUID!) {
    deleteCharge(chargeId: $chargeId)
  }
`;

const MergeChargesMutation = gql`
  mutation CacheTestMergeCharges($baseChargeID: UUID!, $chargeIdsToMerge: [UUID!]!) {
    mergeCharges(baseChargeID: $baseChargeID, chargeIdsToMerge: $chargeIdsToMerge) {
      ... on MergeChargeSuccessfulResult {
        charge {
          id
          userDescription
          metadata {
            transactionsCount
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

const GenerateRevaluationChargeMutation = gql`
  mutation CacheTestGenerateRevaluationCharge($ownerId: UUID!, $date: TimelessDate!) {
    generateRevaluationCharge(ownerId: $ownerId, date: $date) {
      id
    }
  }
`;

const ChargeLedgerQuery = gql`
  query CacheTestChargeLedger($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ledger {
        records {
          id
          description
        }
        validate {
          differences {
            id
            description
          }
        }
      }
    }
  }
`;

function commonCharge(id: string, userDescription: string | null = null) {
  return {
    __typename: 'CommonCharge',
    id,
    userDescription,
    metadata: { __typename: 'ChargeMetadata', transactionsCount: 1 },
  };
}

function businessTripCharge(id: string, userDescription: string | null = null) {
  return {
    ...commonCharge(id, userDescription),
    __typename: 'BusinessTripCharge',
    businessTrip: { __typename: 'BusinessTrip', id: 'trip-1', name: 'Berlin' },
  };
}

function chargesList(...nodes: unknown[]) {
  return {
    allCharges: {
      __typename: 'PaginatedCharges',
      nodes,
      pageInfo: { __typename: 'PageInfo', totalPages: 1 },
    },
  };
}

type Nodes = Array<{ id: string; __typename: string; businessTrip?: { name: string } }>;

async function readList(client: Client, requestPolicy: 'cache-only' | 'cache-first') {
  const result = await client.query(ChargesListQuery, {}, { requestPolicy }).toPromise();
  return result.data?.allCharges.nodes as Nodes | undefined;
}

function cachedClient(operations: string[], responses: Record<string, ScriptedResponse>): Client {
  return makeScriptedClient({ operations, responses, cache: true });
}

describe('normalized cache configuration', () => {
  it('keys every Charge implementor by id alone, so a retyped charge stays one entity', () => {
    expect(CHARGE_TYPENAMES).toEqual(
      expect.arrayContaining([
        'CommonCharge',
        'BusinessTripCharge',
        'FinancialCharge',
        'ForeignSecuritiesCharge',
        'SalaryCharge',
      ]),
    );
    expect(cacheOptions.globalIDs).toEqual(CHARGE_TYPENAMES);

    const store = new Store(cacheOptions);
    const keys = CHARGE_TYPENAMES.map(__typename => store.keyOfEntity({ __typename, id: 'c1' }));
    expect(new Set(keys)).toEqual(new Set(['c1']));
    // Every other entity keeps its typename, so a bare charge id cannot collide with one.
    expect(store.keyOfEntity({ __typename: 'Tag', id: 'c1' })).toBe('Tag:c1');
  });

  it('embeds keyless types and ledger records instead of normalizing them', () => {
    for (const typename of [
      'PaginatedCharges',
      'PageInfo',
      'ChargeMetadata',
      'FinancialAmount',
      'UpdateChargeSuccessfulResult',
      'BatchUpdateChargesSuccessfulResult',
      'CommonError',
      'LedgerRecord',
    ]) {
      expect(cacheKeys[typename]?.({ __typename: typename })).toBeNull();
    }
    for (const typename of ['CommonCharge', 'Tag', 'Query', 'Mutation']) {
      expect(cacheKeys[typename]).toBeUndefined();
    }
  });
});

describe('normalized cache behaviour', () => {
  it('serves a repeated query from the cache', async () => {
    const operations: string[] = [];
    const client = cachedClient(operations, {
      CacheTestChargesList: () => chargesList(commonCharge('c1')),
    });

    await readList(client, 'cache-first');
    await readList(client, 'cache-first');

    expect(operations).toEqual(['CacheTestChargesList']);
  });

  it('follows a charge whose mutation result comes back as a different type', async () => {
    const operations: string[] = [];
    const client = cachedClient(operations, {
      CacheTestChargesList: () =>
        chargesList(commonCharge('c1'), businessTripCharge('c2', 'Other trip')),
      CacheTestCharge: () => ({ charge: commonCharge('c1') }),
      CacheTestUpdateCharge: () => ({
        updateCharge: {
          __typename: 'UpdateChargeSuccessfulResult',
          charge: businessTripCharge('c1', 'Now a trip'),
        },
      }),
    });

    await readList(client, 'cache-first');
    await client.query(ChargeQuery, { chargeId: 'c1' }).toPromise();
    operations.length = 0;

    await client
      .mutation(UpdateChargeMutation, { chargeId: 'c1', fields: { type: 'BUSINESS_TRIP' } })
      .toPromise();

    const nodes = await readList(client, 'cache-only');
    expect(nodes?.map(node => [node.id, node.__typename])).toEqual([
      ['c1', 'BusinessTripCharge'],
      ['c2', 'BusinessTripCharge'],
    ]);
    expect(nodes?.[0].businessTrip?.name).toBe('Berlin');

    const single = await client
      .query(ChargeQuery, { chargeId: 'c1' }, { requestPolicy: 'cache-only' })
      .toPromise();
    expect(single.data?.charge).toMatchObject({
      __typename: 'BusinessTripCharge',
      userDescription: 'Now a trip',
    });

    // No list or charge refetch: the payload was enough, and the other cached business-trip charge
    // was not invalidated as if a new entity of that type had appeared.
    expect(operations).toEqual(['CacheTestUpdateCharge']);
    expect(await readList(client, 'cache-first')).toHaveLength(2);
    expect(operations).toEqual(['CacheTestUpdateCharge']);
  });

  it('follows a charge whose query result comes back as a different type', async () => {
    // A charge with no stored type has one derived from its businesses, trip and transactions, so a
    // mutation that never returns it can still retype it. The next response carrying it fixes every
    // link.
    const client = cachedClient([], {
      CacheTestChargesList: () => chargesList(commonCharge('c1')),
      CacheTestCharge: () => ({ charge: businessTripCharge('c1') }),
    });

    await readList(client, 'cache-first');
    await client
      .query(ChargeQuery, { chargeId: 'c1' }, { requestPolicy: 'network-only' })
      .toPromise();

    const nodes = await readList(client, 'cache-only');
    expect(nodes?.[0]).toMatchObject({ __typename: 'BusinessTripCharge' });
  });

  it('keeps ledger differences apart from the stored records whose ids they reuse', async () => {
    const client = cachedClient([], {
      CacheTestChargeLedger: () => ({
        charge: {
          __typename: 'CommonCharge',
          id: 'c1',
          ledger: {
            __typename: 'Ledger',
            records: [{ __typename: 'LedgerRecord', id: 'r1', description: 'stored' }],
            validate: {
              __typename: 'LedgerValidation',
              differences: [
                { __typename: 'LedgerRecord', id: 'r1', description: 'regenerated' },
                { __typename: 'LedgerRecord', id: EMPTY_UUID, description: 'new A' },
                { __typename: 'LedgerRecord', id: EMPTY_UUID, description: 'new B' },
              ],
            },
          },
        },
      }),
    });

    const result = await client.query(ChargeLedgerQuery, { chargeId: 'c1' }).toPromise();
    const ledger = result.data?.charge.ledger as {
      records: Array<{ description: string }>;
      validate: { differences: Array<{ description: string }> };
    };

    expect(ledger.records.map(record => record.description)).toEqual(['stored']);
    expect(ledger.validate.differences.map(record => record.description)).toEqual([
      'regenerated',
      'new A',
      'new B',
    ]);
  });

  it('drops a deleted charge, so the lists it was in refetch', async () => {
    const operations: string[] = [];
    const client = cachedClient(operations, {
      CacheTestChargesList: () => chargesList(commonCharge('c1'), commonCharge('c2')),
      CacheTestDeleteCharge: () => ({ deleteCharge: true }),
    });

    await readList(client, 'cache-first');
    await client.mutation(DeleteChargeMutation, { chargeId: 'c1' }).toPromise();
    await readList(client, 'cache-first');

    expect(operations).toEqual([
      'CacheTestChargesList',
      'CacheTestDeleteCharge',
      'CacheTestChargesList',
    ]);
  });

  it('drops the charges a merge folded into the base charge', async () => {
    const operations: string[] = [];
    const client = cachedClient(operations, {
      CacheTestChargesList: () => chargesList(commonCharge('c1'), commonCharge('c2')),
      CacheTestMergeCharges: () => ({
        mergeCharges: { __typename: 'MergeChargeSuccessfulResult', charge: commonCharge('c1') },
      }),
    });

    await readList(client, 'cache-first');
    await client
      .mutation(MergeChargesMutation, { baseChargeID: 'c1', chargeIdsToMerge: ['c2'] })
      .toPromise();
    await readList(client, 'cache-first');

    expect(operations).toEqual([
      'CacheTestChargesList',
      'CacheTestMergeCharges',
      'CacheTestChargesList',
    ]);
  });

  it('refetches charge lists after a mutation creates a charge', async () => {
    const operations: string[] = [];
    const client = cachedClient(operations, {
      CacheTestChargesList: () => chargesList(commonCharge('c1')),
      CacheTestGenerateRevaluationCharge: () => ({
        generateRevaluationCharge: { __typename: 'FinancialCharge', id: 'c9' },
      }),
    });

    await readList(client, 'cache-first');
    await client
      .mutation(GenerateRevaluationChargeMutation, { ownerId: 'owner-1', date: '2024-12-31' })
      .toPromise();
    await readList(client, 'cache-first');

    expect(operations).toEqual([
      'CacheTestChargesList',
      'CacheTestGenerateRevaluationCharge',
      'CacheTestChargesList',
    ]);
  });
});
