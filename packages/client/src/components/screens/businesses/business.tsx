import { useEffect, type ReactElement } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import Business from '@/components/business/index.js';
import { BusinessScreenDocument } from '../../../gql/graphql.js';
import { AccounterLoader } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessScreen($businessId: UUID!) {
    business(id: $businessId) {
      id
      ...BusinessPage
    }
  }
`;

export function getBusinessHref(businessId: string): string {
  return `/businesses/${businessId}`;
}

export const BusinessScreen = (): ReactElement => {
  const match = useMatch('/businesses/:businessId');

  const businessId = match?.params.businessId;

  const [{ data, fetching }, fetchBusiness] = useQuery({
    query: BusinessScreenDocument,
    pause: !businessId,
    variables: {
      businessId: businessId ?? '',
    },
  });

  useEffect(() => {
    if (businessId) {
      fetchBusiness();
    }
  }, [businessId, fetchBusiness]);

  if (fetching && !data?.business) {
    return <AccounterLoader />;
  }

  if (!businessId || !data?.business) {
    return <div>Business not found</div>;
  }

  return <Business data={data.business} refetchBusiness={async () => fetchBusiness()} />;
};
