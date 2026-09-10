import type { ReactElement } from 'react';
import { useLoaderData, useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { ChargesTable } from '@/components/charges/charges-table.js';
import { ChargeScreenDocument, type ChargeScreenQuery } from '@/gql/graphql.js';
import { AccounterLoader } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeScreen($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ...ChargeForChargesTableFields
    }
  }
`;

type Props = {
  chargeId?: string;
};

export const Charge = ({ chargeId }: Props): ReactElement => {
  const { chargeId: chargeIdFromUrl } = useParams<{ chargeId: string }>();
  const id = chargeId || chargeIdFromUrl;

  // Present when the route's loader ran; `undefined` on a route without one.
  const loaderData = useLoaderData() as ChargeScreenQuery | undefined;

  const [{ data, fetching }] = useQuery({
    query: ChargeScreenDocument,
    pause: !id || !!loaderData,
    variables: {
      chargeId: id ?? '',
    },
  });

  // Use loader data if available, otherwise use query data
  const chargeData = loaderData || data;
  const isLoading = !loaderData && fetching;

  if (!id) {
    return <div>Charge not found</div>;
  }

  return isLoading ? (
    <AccounterLoader />
  ) : (
    <ChargesTable data={chargeData?.charge ? [chargeData.charge] : []} isAllOpened />
  );
};
