import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum } from '../../../../../shared/enums.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { BusinessesProvider } from '../../../../financial-entities/providers/businesses.provider.js';
import { ChargeTagsProvider } from '../../../../tags/providers/charge-tags.provider.js';
import { TagsProvider } from '../../../../tags/providers/tags.provider.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import { chargeSuggestionsResolvers, getPhraseSuggestions } from '../charge-suggestions.resolver.js';

/**
 * The phrase-matching part of `missingInfoSuggestions`: a charge whose transactions mention a
 * business's phrase gets that business's description and tags. Tags are looked up only for the
 * suggestion that matched, and the phrase table is built once per request.
 */

vi.mock('../../../helpers/charge-type.js', () => ({
  getChargeType: vi.fn(async () => ChargeTypeEnum.Common),
}));
vi.mock('../../../helpers/common.helper.js', () => ({
  calculateTotalAmount: vi.fn(async () => ({ raw: -50 })),
  getChargeBusinesses: vi.fn(async () => ({ allBusinessIds: [], mainBusinessId: null })),
}));

const TAG_A = '00000000-0000-4000-8000-00000000000a';
const TAG_B = '00000000-0000-4000-8000-00000000000b';
const TAG_C = '00000000-0000-4000-8000-00000000000c';

function business(id: string, suggestionData: unknown) {
  return { id, suggestion_data: suggestionData };
}

let businesses: ReturnType<typeof business>[];
let transactionDescriptions: Record<string, string>;
const loadTagById = vi.fn(async (id: string) => ({ id, name: `tag ${id.slice(-1)}` }));
const loadTagByName = vi.fn(async (name: string) => ({ id: `id-${name}`, name }));

function makeInjector(): Injector {
  // One business list per request, as the operation-scoped provider caches it.
  const requestBusinesses = Promise.resolve(businesses);
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          financialAccounts: {},
          defaultLocalCurrency: 'ILS',
        }),
      },
    ],
    [ChargeTagsProvider, { getTagsByChargeIDLoader: { load: async () => [] } }],
    [BusinessesProvider, { getAllBusinesses: () => requestBusinesses }],
    [
      TransactionsProvider,
      {
        transactionsByChargeIDLoader: {
          load: async (chargeId: string) => [
            { source_description: transactionDescriptions[chargeId] ?? '', source_reference: 'r' },
          ],
        },
      },
    ],
    [
      TagsProvider,
      { getTagByIDLoader: { load: loadTagById }, getTagByNameLoader: { load: loadTagByName } },
    ],
  ]);
  return {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error('unexpected provider requested');
      }
      return providers.get(token);
    },
  } as unknown as Injector;
}

type SuggestionsResolver = (
  charge: unknown,
  args: unknown,
  context: unknown,
  info: unknown,
) => Promise<{ description?: string; tags: { id: string }[] } | null>;
const missingInfoSuggestions = (
  chargeSuggestionsResolvers.CommonCharge as { missingInfoSuggestions: SuggestionsResolver }
).missingInfoSuggestions;

function suggest(chargeId: string, injector: Injector) {
  return missingInfoSuggestions(
    { id: chargeId, owner_id: 'owner-1', user_description: null },
    {},
    { injector },
    {},
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  businesses = [
    business('b-1', { phrases: ['ACME'], description: 'Acme subscription', tags: [TAG_A, TAG_B] }),
    business('b-2', { phrases: ['GLOBEX'], description: 'Globex consulting', tags: [TAG_C] }),
    business('b-3', { description: 'No phrases here', tags: [TAG_C] }),
  ];
  transactionDescriptions = {};
});

describe('missingInfoSuggestions phrase matching', () => {
  it("suggests the matching business's description and tags", async () => {
    transactionDescriptions = { c1: 'card payment ACME 12/24' };

    const result = await suggest('c1', makeInjector());

    expect(result?.description).toBe('Acme subscription');
    expect(result?.tags.map(tag => tag.id)).toEqual([TAG_A, TAG_B]);
  });

  it('looks up only the tags of the suggestion that matched', async () => {
    transactionDescriptions = { c1: 'GLOBEX invoice' };

    await suggest('c1', makeInjector());

    expect(loadTagById.mock.calls.map(([id]) => id)).toEqual([TAG_C]);
  });

  it('looks up no tags when no phrase matches', async () => {
    transactionDescriptions = { c1: 'something unrelated' };

    const result = await suggest('c1', makeInjector());

    expect(result).toBeNull();
    expect(loadTagById).not.toHaveBeenCalled();
    expect(loadTagByName).not.toHaveBeenCalled();
  });

  it('resolves legacy tag names by name', async () => {
    businesses = [business('b-1', { phrases: ['ACME'], description: 'Acme' })];
    // The schema accepts only ids today, so patch the request's table to cover older rows. The
    // resolver reads this same table: it is cached on the same business list.
    getPhraseSuggestions(businesses as never)['ACME'] = { description: 'Acme', tags: ['software'] };
    transactionDescriptions = { c1: 'ACME' };

    const result = await suggest('c1', makeInjector());

    expect(loadTagByName).toHaveBeenCalledWith('software');
    expect(result?.tags).toEqual([{ id: 'id-software', name: 'software' }]);
  });
});

describe('getPhraseSuggestions', () => {
  it('gives a phrase two businesses share to the later one', () => {
    const table = getPhraseSuggestions([
      business('b-1', { phrases: ['SHARED'], description: 'first' }),
      business('b-2', { phrases: ['SHARED'], description: 'second' }),
    ] as never);

    expect(table['SHARED']?.description).toBe('second');
  });

  it('skips businesses whose suggestion data does not parse, logging each once per request', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    businesses = [
      business('bad', { phrases: ['ACME'], unknownField: true }),
      business('b-2', { phrases: ['GLOBEX'], description: 'Globex', tags: [TAG_C] }),
    ];
    transactionDescriptions = { c1: 'ACME', c2: 'GLOBEX', c3: 'ACME GLOBEX' };
    const injector = makeInjector();

    const results = await Promise.all(['c1', 'c2', 'c3'].map(id => suggest(id, injector)));

    expect(results.map(result => result?.description ?? null)).toEqual([
      null,
      'Globex',
      'Globex',
    ]);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('builds the table once per business list', () => {
    const list = [business('b-1', { phrases: ['ACME'], description: 'Acme' })] as never;

    expect(getPhraseSuggestions(list)).toBe(getPhraseSuggestions(list));
    expect(getPhraseSuggestions([...(list as unknown[])] as never)).not.toBe(
      getPhraseSuggestions(list),
    );
  });
});
