import { createContext, useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { useQuery } from 'urql';
import { ChargesExtendedInfoBatchDocument, type FetchChargeQuery } from '../../gql/graphql.js';

// A single query that fetches the extended info for many charges at once. It mirrors the
// selection set of `FetchCharge` (see `charge-extended-info.tsx`) — including the same deferred
// fragments — so the per-charge `ChargeExtendedInfo` component can consume a batched charge
// interchangeably with the result of its own single-charge query.
//
// This is the "loader" behind the table's batch-open (expand-all) action: instead of every
// expanded row firing its own `FetchCharge` query (100 queries for a full page), one
// `chargesByIDs` query hydrates them all.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargesExtendedInfoBatch($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      ...ChargeExpansionFields
    }
  }
`;

type ExtendedCharge = FetchChargeQuery['charge'];

interface BatchChargesExtendedInfoContextValue {
  /** Whether the batch loader is active (batch-open / expand-all is on). */
  active: boolean;
  /** Whether the batched query is currently in flight. */
  fetching: boolean;
  /** Returns the batched extended info for a charge, or undefined if not (yet) loaded. */
  getCharge: (chargeId: string) => ExtendedCharge | undefined;
  /** Refetch the whole batch (network-only). Used when a batched charge is mutated. */
  refetch: () => void;
}

const noop = (): void => void 0;

export const BatchChargesExtendedInfoContext = createContext<BatchChargesExtendedInfoContextValue>({
  active: false,
  fetching: false,
  getCharge: () => undefined,
  refetch: noop,
});

interface Props {
  /** Ids of all charges the loader should hydrate when active (typically every row on the page). */
  chargeIds: string[];
  /** When true, run the single batched query; when false, the loader stays paused (per-row mode). */
  active: boolean;
  children: ReactNode;
}

export function BatchChargesExtendedInfoProvider({
  chargeIds,
  active,
  children,
}: Props): ReactElement {
  const [{ data, fetching }, refetchQuery] = useQuery({
    query: ChargesExtendedInfoBatchDocument,
    variables: { chargeIDs: chargeIds },
    pause: !active || chargeIds.length === 0,
  });

  const chargesById = useMemo(() => {
    const map = new Map<string, ExtendedCharge>();
    for (const charge of data?.chargesByIDs ?? []) {
      // The batched charge is structurally identical to a `FetchCharge` charge (same selection
      // set); cast so consumers can treat both sources uniformly.
      map.set(charge.id, charge as unknown as ExtendedCharge);
    }
    return map;
  }, [data]);

  const refetch = useCallback(() => {
    refetchQuery({ requestPolicy: 'network-only' });
  }, [refetchQuery]);

  const value = useMemo<BatchChargesExtendedInfoContextValue>(
    () => ({
      active,
      fetching: active ? fetching : false,
      getCharge: (chargeId: string) => chargesById.get(chargeId),
      refetch,
    }),
    [active, fetching, chargesById, refetch],
  );

  return (
    <BatchChargesExtendedInfoContext.Provider value={value}>
      {children}
    </BatchChargesExtendedInfoContext.Provider>
  );
}
