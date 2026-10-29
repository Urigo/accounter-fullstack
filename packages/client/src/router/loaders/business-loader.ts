import type { LoaderFunctionArgs } from 'react-router-dom';
import { BusinessScreenDocument } from '../../gql/graphql.js';
import { getUrqlClient } from '../../providers/urql.js';
import { validateBusinessParams } from '../types.js';

/**
 * Business loader - prefetches business data before component renders
 * Used by: /businesses/:businessId route
 */
export async function businessLoader({ params }: LoaderFunctionArgs) {
  const { businessId } = validateBusinessParams(params);

  const client = getUrqlClient();
  // `network-only`: `toPromise` settles on the first result, which under the client's
  // `cache-and-network` default may be the cached copy, and the screen pauses its own query when
  // loader data is present, so nothing would revalidate it.
  const result = await client
    .query(BusinessScreenDocument, { businessId }, { requestPolicy: 'network-only' })
    .toPromise();

  // GraphQL errors are now handled by toast notifications in urql-client
  // Only throw for 404 to show the error boundary
  if (!result.data?.business) {
    throw new Response('Business not found', { status: 404 });
  }

  return result.data;
}
