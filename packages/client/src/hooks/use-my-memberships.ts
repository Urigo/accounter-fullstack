import { useEffect, useMemo } from 'react';
import { useQuery } from 'urql';
import { MyMembershipsDocument } from '../gql/graphql.js';
import { UNSCOPED_OPERATION_CONTEXT } from '../providers/urql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MyMemberships {
    myMemberships {
      id
      businessId
      businessName
    }
  }
`;

export type MyMembership = {
  businessId: string;
  businessName?: string | null;
};

type UseMyMemberships = {
  fetching: boolean;
  memberships: MyMembership[];
};

/**
 * The caller's business memberships, fetched *without* the `x-business-scope`
 * header.
 *
 * Scoping this query would be circular: its result is the list a user picks
 * from to change the scope, so narrowing it by the current scope hides the
 * other businesses' names behind bare UUIDs and strands the user in whatever
 * scope they chose. `UNSCOPED_OPERATION_CONTEXT` is what exempts it.
 *
 * Errors are logged, never toasted: this is background enrichment behind a
 * dropdown, and `myMemberships` is role-gated, so a caller outside the gate
 * would otherwise raise an error toast every time the menu opens. Callers get
 * an empty list and fall back.
 */
export const useMyMemberships = ({ pause = false }: { pause?: boolean } = {}): UseMyMemberships => {
  const [{ data, fetching, error }] = useQuery({
    query: MyMembershipsDocument,
    context: UNSCOPED_OPERATION_CONTEXT,
    pause,
  });

  useEffect(() => {
    if (error) {
      console.error(`Error fetching memberships: ${error}`);
    }
  }, [error]);

  const memberships = useMemo(
    () =>
      (data?.myMemberships ?? [])
        .slice()
        .sort((a, b) =>
          (a.businessName ?? a.businessId).localeCompare(b.businessName ?? b.businessId),
        ),
    [data],
  );

  return { fetching, memberships };
};
