import { parse } from 'graphql';
import { getOperationName, type Exchange, type Operation, type OperationResult } from 'urql';
import { filter, makeSubject, map, merge, pipe, share, tap } from 'wonka';
import { cacheExchange, type Cache, type CacheExchangeOpts } from '@urql/exchange-graphcache';
import { ChargesTableApprovalFieldsFragmentDoc, type AccountantStatus } from '../gql/graphql.js';
import possibleTypes from '../gql/possible-types.js';

/**
 * The client's normalized cache (Graphcache), for the charges list only.
 *
 * A normalized cache stores each entity once, under its type and id, so a mutation that returns a
 * charge updates every query showing that charge, with no refetch. That is safe only for types
 * whose `id` really identifies them, and only where the screens were written with a cache in mind.
 * Neither has been checked for the rest of the app, which has always had no cache at all: every
 * query goes to the network, and every screen refetches after its own mutations. So the cache is
 * adopted one route at a time, and an operation takes part only when its name is listed here.
 * Everything else skips the cache entirely and behaves as before.
 *
 * Adding an operation: check that every type it selects with an `id` is the same object wherever
 * that id appears, give the types it selects without one an entry in `keys`, and select `id` on
 * every entity. A mutation belongs here once its result carries what it changed
 * (`ChargeMutationResultFields`), or once `updates` below says what it changed.
 */
const CACHED_OPERATIONS: ReadonlySet<string> = new Set([
  // The All Charges list, and the single-row query every charges table uses to refresh a row.
  'AllCharges',
  'RefetchChargeForChargesTable',
  // The edits made from a row. Their results carry the row's fields.
  'UpdateCharge',
  'BatchUpdateCharges',
  'BatchUpdateChargesTags',
  // Returns only the new status; `updates` writes it onto the charge.
  'UpdateChargeAccountantApproval',
]);

export function isCachedOperation(operation: Operation): boolean {
  const name = getOperationName(operation.query);
  return name !== undefined && CACHED_OPERATIONS.has(name);
}

/** The concrete types behind the `Charge` interface. The cache files a charge under one of them. */
const CHARGE_TYPES: readonly string[] = possibleTypes.possibleTypes.Charge;

/** The cache keys under which a charge with this id may be stored, one per concrete type. */
function chargeKeys(cache: Cache, id: string): string[] {
  return CHARGE_TYPES.map(__typename => cache.keyOfEntity({ __typename, id })).filter(
    (key): key is string => !!key,
  );
}

/** The keys among `chargeKeys` that hold a charge now. */
function cachedChargeKeys(cache: Cache, id: string): string[] {
  return chargeKeys(cache, id).filter(key => cache.resolve(key, 'id') != null);
}

// Parsed here, not a generated document: nothing queries this shape, it only addresses the one
// deferred field for a cache write.
const ChargeLedgerValidityFragment = parse(
  'fragment ChargeLedgerValidity on Charge { id metadata { invalidLedger } }',
);

/**
 * Hands a charge's deferred row parts (the suggestions and the ledger validation) on to the entry
 * for its new type, where that has none.
 *
 * A mutation's result does not carry them. Without them a list holding the charge can no longer be
 * read whole, and the cache would fetch the whole list again to fill them in. The values are the
 * pre-edit ones, as they are after any other edit, until the row is next refetched.
 */
function keepDeferredParts(
  cache: Cache,
  formerKey: string,
  charge: { __typename: string; id: string },
): void {
  const suggestions = cache.resolve(formerKey, 'missingInfoSuggestions');
  if (
    cache.resolve(charge, 'missingInfoSuggestions') === undefined &&
    (suggestions === null || typeof suggestions === 'string')
  ) {
    cache.link(charge, 'missingInfoSuggestions', suggestions);
  }

  const formerMetadata = cache.resolve(formerKey, 'metadata');
  const metadata = cache.resolve(charge, 'metadata');
  if (typeof formerMetadata !== 'string' || typeof metadata !== 'string') {
    return;
  }
  const invalidLedger = cache.resolve(formerMetadata, 'invalidLedger');
  if (invalidLedger !== undefined && cache.resolve(metadata, 'invalidLedger') === undefined) {
    cache.writeFragment(ChargeLedgerValidityFragment, {
      ...charge,
      metadata: { __typename: 'ChargeMetadata', invalidLedger },
    });
  }
}

/**
 * Points every cached reference to a charge at the type it has now.
 *
 * A charge's concrete type is decided when it is read: setting a business trip on a `CommonCharge`
 * makes it a `BusinessTripCharge` with the same id. The cache files the answer under the new type,
 * while the lists that showed the charge still point at the old one, so without this the row
 * would keep its pre-edit values.
 */
function adoptChargeType(cache: Cache, charge: unknown): void {
  if (!charge || typeof charge !== 'object') {
    return;
  }
  const { __typename, id } = charge as { __typename?: unknown; id?: unknown };
  if (typeof __typename !== 'string' || typeof id !== 'string') {
    return;
  }
  const current = cache.keyOfEntity({ __typename, id });
  if (!current) {
    return;
  }
  const former = new Set(chargeKeys(cache, id).filter(key => key !== current));
  for (const key of former) {
    keepDeferredParts(cache, key, { __typename, id });
  }

  for (const field of cache.inspectFields('Query')) {
    if (field.fieldName === 'charge') {
      const linked = cache.resolve('Query', field.fieldKey);
      if (typeof linked === 'string' && former.has(linked)) {
        cache.link('Query', field.fieldKey, current);
      }
    } else if (field.fieldName === 'allCharges') {
      const page = cache.resolve('Query', field.fieldKey);
      const nodes = typeof page === 'string' ? cache.resolve(page, 'nodes') : null;
      if (
        typeof page === 'string' &&
        Array.isArray(nodes) &&
        nodes.some(node => typeof node === 'string' && former.has(node))
      ) {
        cache.link(
          page,
          'nodes',
          (nodes as string[]).map(node => (former.has(node) ? current : node)),
        );
      }
    }
  }
}

const chargesCacheConfig: CacheExchangeOpts = {
  // Lets a fragment on an interface or union (`... on Charge`) match the concrete type an entity
  // is stored under. Without it the cache guesses from the fields it happens to hold.
  possibleTypes: possibleTypes.possibleTypes,
  keys: {
    // Not entities: they have no id and belong to the object that holds them, so they are stored
    // as part of it.
    ChargeMetadata: () => null,
    ChargeSuggestions: () => null,
    FinancialAmount: () => null,
    PageInfo: () => null,
    PaginatedCharges: () => null,
    ValidationData: () => null,
    // Mutation payload wrappers.
    BatchUpdateChargesSuccessfulResult: () => null,
    BatchUpdateChargesTagsSuccessfulResult: () => null,
    CommonError: () => null,
    UpdateChargeSuccessfulResult: () => null,
  },
  resolvers: {
    Query: {
      // Lets `charge(chargeId)` be answered with a charge a list already loaded. The cache links
      // a query field to the entity it returned, and has no such link for a request never made.
      charge(_parent, args, cache) {
        const linked = cache.resolve('Query', 'charge', args);
        if (typeof linked === 'string') {
          return linked;
        }
        return typeof args.chargeId === 'string'
          ? cachedChargeKeys(cache, args.chargeId)[0]
          : undefined;
      },
    },
  },
  updates: {
    Query: {
      charge(result, _args, cache) {
        adoptChargeType(cache, result.charge);
      },
    },
    Mutation: {
      updateCharge(result, _args, cache) {
        adoptChargeType(cache, (result.updateCharge as { charge?: unknown } | null)?.charge);
      },
      // The result is the new status alone. The charge's id is in the arguments, and approving
      // changes nothing else on the charge, so that is all there is to write.
      updateChargeAccountantApproval(result, args, cache) {
        const status = result.updateChargeAccountantApproval;
        if (typeof status !== 'string' || typeof args.chargeId !== 'string') {
          return;
        }
        for (const __typename of CHARGE_TYPES) {
          const charge = { __typename, id: args.chargeId };
          if (cache.resolve(charge, 'id') != null) {
            cache.writeFragment(ChargesTableApprovalFieldsFragmentDoc, {
              ...charge,
              accountantApproval: status as AccountantStatus,
            });
          }
        }
      },
    },
  },
};

/**
 * Sends the operations `isInScope` accepts through `exchange`, and every other operation straight
 * on to the next exchange, as if `exchange` were not installed.
 *
 * Both paths share one downstream pipeline. Calling `forward` once per path would build the
 * exchanges after this one twice, and those hold state (the auth exchange queues and replays
 * operations): a replayed operation would then be sent twice.
 */
export function scopedExchange(
  isInScope: (operation: Operation) => boolean,
  exchange: Exchange,
): Exchange {
  return ({ client, forward, dispatchDebug }) =>
    operations$ => {
      const operations = pipe(operations$, share);
      // What `exchange` forwards, on its way to the shared downstream.
      const forwarded = makeSubject<Operation>();
      const downstreamResults = pipe(
        merge([
          pipe(
            operations,
            filter(operation => !isInScope(operation)),
          ),
          forwarded.source,
        ]),
        forward,
        share,
      );

      const scoped = exchange({
        client,
        dispatchDebug,
        // Shared, as urql shares the `forward` it hands every exchange: an exchange may read its
        // results in more than one place, and each extra subscription here would forward its
        // operations (a mutation among them) once more.
        forward: scopedOperations$ =>
          pipe(
            merge([
              pipe(
                scopedOperations$,
                tap(forwarded.next),
                filter((_operation): _operation is never => false),
              ),
              pipe(
                downstreamResults,
                filter((result: OperationResult) => isInScope(result.operation)),
              ),
            ]),
            share,
          ),
      });

      return merge([
        pipe(operations, filter(isInScope), scoped),
        pipe(
          downstreamResults,
          filter(result => !isInScope(result.operation)),
        ),
      ]);
    };
}

/**
 * Lets the client send the request the cache asks for after answering a query in part.
 *
 * When the cache holds a charge but not the parts of the row that arrive later (`@defer`), it
 * answers with what it has, marks the answer as having more to come, and asks the client to run
 * the query again against the network. The client drops that request: it still counts the query
 * as in flight, and releases it only for an answer marked stale. Unmarked, the row would keep the
 * partial charge, and every later refetch of it would be dropped too. The answer is stale in the
 * plain sense as well, so say so.
 */
function markPartialAnswerStale(result: OperationResult): OperationResult {
  return result.hasNext &&
    !result.stale &&
    result.operation.context.meta?.cacheOutcome === 'partial'
    ? { ...result, stale: true }
    : result;
}

/**
 * The cache, limited to `CACHED_OPERATIONS`. A function, not a shared instance: a new client must
 * start with an empty cache, which is what keeps one user's or business scope's data from reaching
 * the next (`resetUrqlClientAndNotify`).
 */
export function chargesCacheExchange(): Exchange {
  const cache = cacheExchange(chargesCacheConfig);
  return scopedExchange(
    isCachedOperation,
    input => operations$ => pipe(cache(input)(operations$), map(markPartialAnswerStale)),
  );
}
