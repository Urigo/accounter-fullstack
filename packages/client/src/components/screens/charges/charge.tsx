import { useEffect, useState, type ReactElement } from 'react';
import { useLoaderData, useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { ChargeScreenDocument, type ChargeScreenQuery } from '../../../gql/graphql.js';
import { ChargesTable } from '../../charges/charges-table.js';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
} from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeScreen($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ...ChargesTableFields
    }
  }
`;

type Props = {
  chargeId?: string;
};

export const Charge = ({ chargeId }: Props): ReactElement => {
  const { chargeId: chargeIdFromUrl } = useParams<{ chargeId: string }>();
  const id = chargeId || chargeIdFromUrl;

  // Try to get loader data (will be available when navigating via router)
  let loaderData: ChargeScreenQuery | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    loaderData = useLoaderData() as ChargeScreenQuery;
  } catch {
    // No loader data - component used outside router context (e.g., as child component)
  }

  const [editChargeId, setEditChargeId] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [insertDocument, setInsertDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [matchDocuments, setMatchDocuments] = useState<{ id: string; ownerId: string } | undefined>(
    undefined,
  );

  // Only fetch if we don't have loader data and need to fetch (prop-based usage)
  const [{ data, fetching }, fetchCharge] = useQuery({
    query: ChargeScreenDocument,
    pause: !id || !!loaderData,
    variables: {
      chargeId: id ?? '',
    },
  });

  useEffect(() => {
    if (id && !loaderData) {
      fetchCharge();
    }
  }, [id, loaderData, fetchCharge]);

  // Use loader data if available, otherwise use query data
  const chargeData = loaderData || data;
  const isLoading = !loaderData && fetching;

  if (!id) {
    return <div>Charge not found</div>;
  }

  return (
    <>
      {isLoading ? (
        <AccounterLoader />
      ) : (
        <ChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          data={chargeData?.charge ? [chargeData.charge] : []}
          isAllOpened
        />
      )}
      {editChargeId && (
        <EditChargeModal
          chargeId={editChargeId?.id}
          close={() => setEditChargeId(undefined)}
          onChange={editChargeId.onChange}
        />
      )}
      {insertDocument && (
        <InsertDocumentModal
          chargeId={insertDocument.id}
          onChange={insertDocument.onChange}
          close={(): void => setInsertDocument(undefined)}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal
          chargeId={matchDocuments.id}
          ownerId={matchDocuments.ownerId}
          setMatchDocuments={(): void => setMatchDocuments(undefined)}
        />
      )}
    </>
  );
};
