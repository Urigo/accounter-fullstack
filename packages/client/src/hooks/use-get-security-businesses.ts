import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { AllSecurityBusinessesDocument, type AllSecurityBusinessesQuery } from '../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllSecurityBusinesses {
    allSecurityBusinesses {
      id
      name
      securityInfo {
        id
        isin
        symbol
      }
    }
  }
`;

export type SecurityBusinesses = NonNullable<AllSecurityBusinessesQuery['allSecurityBusinesses']>;

type UseGetSecurityBusinesses = {
  fetching: boolean;
  refresh: () => void;
  securityBusinesses: SecurityBusinesses;
  selectableSecurityBusinesses: Array<{ value: string; label: string }>;
};

type UseGetSecurityBusinessesOptions = {
  /** Skips the query entirely — for callers that only need the list in some rows. */
  pause?: boolean;
};

/**
 * The businesses that stand for a traded security, for pickers that should offer only those —
 * the counterparty of a foreign-securities trade, above all.
 *
 * Pausable because its caller is a table cell: a plain transactions table would otherwise run
 * this query once per row for a list it never shows.
 */
export const useGetSecurityBusinesses = ({
  pause,
}: UseGetSecurityBusinessesOptions = {}): UseGetSecurityBusinesses => {
  const [{ data, fetching, error }, fetch] = useQuery({
    query: AllSecurityBusinessesDocument,
    pause,
  });

  useEffect(() => {
    if (error) {
      console.error(`Error fetching security businesses: ${error}`);
      toast.error('Error', {
        description: 'Unable to fetch security businesses',
      });
    }
  }, [error]);

  const securityBusinesses = useMemo(() => {
    return data?.allSecurityBusinesses?.slice().sort((a, b) => a.name.localeCompare(b.name)) ?? [];
  }, [data]);

  const selectableSecurityBusinesses = useMemo(() => {
    return securityBusinesses.map(business => ({
      value: business.id,
      // The ISIN is what makes two share classes of one issuer tellable apart.
      label: business.securityInfo?.isin
        ? `${business.name} · ${business.securityInfo.isin}`
        : business.name,
    }));
  }, [securityBusinesses]);

  return {
    fetching,
    refresh: () => fetch(),
    securityBusinesses,
    selectableSecurityBusinesses,
  };
};
