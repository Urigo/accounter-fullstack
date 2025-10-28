import { type ReactElement } from 'react';
import { useLoaderData, useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import Business from '@/components/business/index.js';
import { BusinessScreenDocument, type BusinessScreenQuery } from '../../../gql/graphql.js';
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

export const BusinessScreen = (): ReactElement => {
  const { businessId } = useParams<{ businessId: string }>();

  // Try to get loader data (will be available when navigating via router)
  let loaderData: BusinessScreenQuery | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    loaderData = useLoaderData() as BusinessScreenQuery;
  } catch {
    // No loader data - fallback to query
  }

  // Only fetch if we don't have loader data
  const [{ data, fetching }, fetchBusiness] = useQuery({
    query: BusinessScreenDocument,
    pause: !businessId || !!loaderData,
    variables: {
      businessId: businessId ?? '',
    },
  });

  // Use loader data if available, otherwise use query data
  const businessData = loaderData || data;
  const isLoading = !loaderData && fetching;

  if (isLoading && !businessData?.business) {
    return <AccounterLoader />;
  }

  if (!businessId || !businessData?.business) {
    return <div>Business not found</div>;
  }

  return <Business data={businessData.business} refetchBusiness={async () => fetchBusiness()} />;
};
