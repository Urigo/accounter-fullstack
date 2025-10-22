import type { LoaderFunctionArgs } from 'react-router-dom';
import { BusinessScreenDocument } from '../../gql/graphql.js';
import { getUrqlClient } from '../../providers/urql-client.js';
import { validateBusinessParams } from '../types.js';

/**
 * Business loader - prefetches business data before component renders
 * Used by: /businesses/:businessId route
 */
export async function businessLoader({ params }: LoaderFunctionArgs) {
  const { businessId } = validateBusinessParams(params);

  const client = getUrqlClient();
  const result = await client.query(BusinessScreenDocument, { businessId }).toPromise();

  if (result.error) {
    throw new Response('Failed to load business', { status: 500 });
  }

  if (!result.data?.business) {
    throw new Response('Business not found', { status: 404 });
  }

  return result.data;
}
