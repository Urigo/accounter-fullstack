import { ReactElement, useState } from 'react';
import { useQuery } from 'urql';
import { ChargeScreenDocument } from '../../gql/graphql.js';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  UploadDocumentModal,
} from '../common/index.js';
import { AllChargesTable } from './all-charges-table.js';
import { useMatch } from '@tanstack/react-router';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeScreen($chargeIds: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIds) {
      id
      ...AllChargesTableFields
    }
  }
`;

type Props = {
  chargeId?: string;
};

export const Charge = ({ chargeId }: Props): ReactElement => {
  const match = useMatch({
    from: '/_auth/charges/$id',
  });

  const id = chargeId || match?.params.id;

  const [editChargeId, setEditChargeId] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [insertDocument, setInsertDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [matchDocuments, setMatchDocuments] = useState<{ id: string; ownerId: string } | undefined>(
    undefined,
  );
  const [uploadDocument, setUploadDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);

  const [{ data, fetching }] = useQuery({
    query: ChargeScreenDocument,
    variables: {
      chargeIds: [id],
    },
  });

  if (!id) {
    return <div>Charge not found</div>;
  }

  return (
    <>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <AllChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          data={data?.chargesByIDs}
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
      {uploadDocument && (
        <UploadDocumentModal
          chargeId={uploadDocument.id}
          close={() => setUploadDocument(undefined)}
          onChange={uploadDocument.onChange}
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
