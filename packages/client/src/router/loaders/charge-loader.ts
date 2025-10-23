import type { LoaderFunctionArgs } from 'react-router-dom';
import { ChargeScreenDocument } from '../../gql/graphql.js';
import { getUrqlClient } from '../../providers/urql-client.js';
import { validateChargeParams } from '../types.js';

/**
 * Charge loader - prefetches charge data before component renders
 * Used by: /charges/:chargeId route
 */
export async function chargeLoader({ params }: LoaderFunctionArgs) {
  const { chargeId } = validateChargeParams(params);

  const client = getUrqlClient();
  const result = await client.query(ChargeScreenDocument, { chargeId }).toPromise();

  // GraphQL errors are now handled by toast notifications in urql-client
  // Only throw for 404 to show the error boundary
  if (!result.data?.charge) {
    throw new Response('Charge not found', { status: 404 });
  }

  return result.data;
}
