import type {
  IntrospectionInterfaceType,
  IntrospectionObjectType,
  IntrospectionType,
} from 'graphql';
import {
  cacheExchange,
  type Cache,
  type CacheExchangeOpts,
  type KeyingConfig,
  type UpdatesConfig,
} from '@urql/exchange-graphcache';
import schema from '../gql/introspection.js';

const schemaTypes: readonly IntrospectionType[] = schema.__schema.types;

const rootTypeNames = new Set(
  [
    schema.__schema.queryType.name,
    schema.__schema.mutationType?.name,
    schema.__schema.subscriptionType?.name,
  ].filter((name): name is string => !!name),
);

/**
 * Every concrete type implementing the `Charge` interface, read from the schema so a new charge
 * type is covered without touching this file.
 */
export const CHARGE_TYPENAMES: readonly string[] = (
  schemaTypes.find(
    (type): type is IntrospectionInterfaceType =>
      type.kind === 'INTERFACE' && type.name === 'Charge',
  )?.possibleTypes ?? []
).map(type => type.name);

/**
 * Types that have an `id` but must not be normalized by it.
 *
 * `LedgerRecord`: `LedgerValidation.differences` returns generated records that reuse the id of the
 * stored record they differ from, or all share `EMPTY_UUID`
 * (server `modules/ledger/helpers/ledgrer-storage.helper.ts`). Normalized, a difference would
 * overwrite the real ledger row it is being compared to, and every new record would collapse into
 * one. Embedded in their parent, each list keeps its own records.
 */
const EMBEDDED_ID_TYPES: readonly string[] = ['LedgerRecord'];

const embedded = (): null => null;

/**
 * `keys: () => null` for every object type with no `id` — payload wrappers, `ChargeMetadata`,
 * `FinancialAmount` and the like. They are values, not entities: embedded in their parent rather
 * than normalized, and graphcache stops warning about them. Derived from the schema, so a new
 * keyless type is covered without a hand-written entry.
 */
export const cacheKeys: KeyingConfig = Object.fromEntries(
  [
    ...schemaTypes
      .filter(
        (type): type is IntrospectionObjectType =>
          type.kind === 'OBJECT' &&
          !rootTypeNames.has(type.name) &&
          !type.fields.some(field => field.name === 'id' || field.name === '_id'),
      )
      .map(type => type.name),
    ...EMBEDDED_ID_TYPES,
  ].map(name => [name, embedded]),
);

/** Root fields that list charges, invalidated when a mutation creates charges. */
const CHARGE_LIST_FIELDS = new Set([
  'allCharges',
  'chargesWithMissingRequiredInfo',
  'chargesByIDs',
  'similarCharges',
  'similarChargesByBusiness',
]);

function invalidateChargeLists(cache: Cache): void {
  for (const field of cache.inspectFields('Query')) {
    if (CHARGE_LIST_FIELDS.has(field.fieldName)) {
      cache.invalidate('Query', field.fieldName, field.arguments ?? undefined);
    }
  }
}

/**
 * Drops a charge that no longer exists. Every query linking to it — a list it was a row of,
 * `charge(chargeId)` — becomes a cache miss and refetches.
 *
 * Any charge typename works here: `globalIDs` keys all of them by id alone.
 */
function invalidateCharge(cache: Cache, chargeId: string): void {
  cache.invalidate({ __typename: CHARGE_TYPENAMES[0], id: chargeId });
  cache.invalidate('Query', 'charge', { chargeId });
}

/**
 * Charges mutations only (#4482). `updateCharge`, `batchUpdateCharges` and
 * `batchUpdateChargesTags` need no entry: their payload carries the changed charge, which
 * graphcache patches by id on its own. Whether an edit moves a charge in or out of a filtered list
 * is the server's call, so lists are left to the refetches the charges screens already run.
 */
const updates: UpdatesConfig = {
  Mutation: {
    deleteCharge(result, args, cache) {
      if (result.deleteCharge) {
        invalidateCharge(cache, args.chargeId as string);
      }
    },
    mergeCharges(result, args, cache) {
      const payload = result.mergeCharges as { __typename?: string } | null;
      if (payload?.__typename !== 'MergeChargeSuccessfulResult') {
        return;
      }
      for (const chargeId of args.chargeIdsToMerge as string[]) {
        invalidateCharge(cache, chargeId);
      }
    },
    // Mutations that create charges, so any cached list may now be missing a row.
    generateRevaluationCharge: (_result, _args, cache) => invalidateChargeLists(cache),
    generateBankDepositsRevaluationCharge: (_result, _args, cache) => invalidateChargeLists(cache),
    generateTaxExpensesCharge: (_result, _args, cache) => invalidateChargeLists(cache),
    generateDepreciationCharge: (_result, _args, cache) => invalidateChargeLists(cache),
    generateRecoveryReserveCharge: (_result, _args, cache) => invalidateChargeLists(cache),
    generateVacationReserveCharge: (_result, _args, cache) => invalidateChargeLists(cache),
    generateBalanceCharge: (_result, _args, cache) => invalidateChargeLists(cache),
  },
};

/** The graphcache configuration, exported for tests that build a `Store` from it. */
export const cacheOptions: CacheExchangeOpts = {
  // Mandatory, not an optimisation: without it, fragments on the 27 unions and 12 interfaces
  // (`Charge`, every mutation result) are matched heuristically and can silently miss.
  schema,
  keys: cacheKeys,
  // A charge's concrete type is not fixed. `updateCharge` with `type` or `businessTripID` retypes
  // it, as can a merge, and a charge stored with no type has one derived from its businesses,
  // business trip and transactions (server `getChargeType`), so unrelated mutations retype it too.
  // Keyed as graphcache's default `Typename:id`, the retyped charge would land as a second entity
  // while every list and `charge(id)` link kept pointing at the stale one. Keyed by id alone there
  // is one record per charge; a write under a new typename replaces its `__typename` in place.
  // Charge ids are one table's UUIDs, and every other type keeps its `Typename:` prefix, so a bare
  // id cannot collide.
  globalIDs: [...CHARGE_TYPENAMES],
  updates,
};

/**
 * A fresh normalized cache. A factory rather than a shared instance: `getUrqlClient` calls it for
 * every client it builds, so swapping the client — on business-scope change and on logout — also
 * discards every cached entity.
 */
export function createCacheExchange(): ReturnType<typeof cacheExchange> {
  return cacheExchange(cacheOptions);
}
