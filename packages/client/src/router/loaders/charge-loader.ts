import type { LoaderFunctionArgs } from 'react-router-dom';
import { ChargeScreenDocument } from '../../gql/graphql.js';
import { getUrqlClient } from '../../providers/urql.js';
import { validateChargeParams } from '../types.js';

/**
 * Charge loader - prefetches charge data before component renders
 * Used by: /charges/:chargeId route
 */
export async function chargeLoader({ params }: LoaderFunctionArgs) {
  const { chargeId } = validateChargeParams(params);

  const client = getUrqlClient();
  // `network-only`: `toPromise` settles on the first result, which under the client's
  // `cache-and-network` default may be the cached copy, and the screen pauses its own query when
  // loader data is present, so nothing would revalidate it.
  const result = await client
    .query(ChargeScreenDocument, { chargeId }, { requestPolicy: 'network-only' })
    .toPromise();

  // GraphQL errors are now handled by toast notifications in urql-client
  // Only throw for 404 to show the error boundary
  if (!result.data?.charge) {
    throw new Response('Charge not found', { status: 404 });
  }

  return result.data;
}
