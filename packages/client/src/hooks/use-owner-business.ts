import { useContext, useMemo } from 'react';
import { useQuery } from 'urql';
import { getFragmentData } from '@/gql/index.js';
import { UserContext } from '@/providers/index.js';
import { BusinessPageFragmentDoc, BusinessScreenDocument } from '../gql/graphql.js';

export function useOwnerBusiness() {
  const { userContext } = useContext(UserContext);
  const businessId = userContext?.context.adminBusinessId ?? '';

  const [{ data, fetching, error }, refetch] = useQuery({
    query: BusinessScreenDocument,
    variables: { businessId },
    pause: !businessId,
  });

  const business = useMemo(() => {
    if (!data?.business) return null;
    return getFragmentData(BusinessPageFragmentDoc, data.business);
  }, [data]);

  const isClient = business
    ? 'clientInfo' in business && !!business.clientInfo
    : false;

  const isAdmin = business
    ? 'adminInfo' in business && !!business.adminInfo
    : false;

  return {
    business,
    businessId,
    isClient,
    isAdmin,
    isLoading: fetching,
    error: error?.message ?? null,
    refetch: async () => {
      refetch({ requestPolicy: 'network-only' });
    },
  };
}
