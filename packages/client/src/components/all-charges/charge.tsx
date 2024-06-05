import { ReactElement, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { graphql } from '../../graphql.js';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  UploadDocumentModal,
} from '../common/index.js';
import { AllChargesTable, AllChargesTableFieldsFragmentDoc } from './all-charges-table.js';

export const ChargeScreenDocument = graphql(
  `
    query ChargeScreen($chargeIds: [UUID!]!) {
      chargesByIDs(chargeIDs: $chargeIds) {
        id
        ...AllChargesTableFields
      }
    }
  `,
  [AllChargesTableFieldsFragmentDoc],
);

type Props = {
  chargeId?: string;
};

export const Charge = ({ chargeId }: Props): ReactElement => {
  const match = useMatch('/charges/:chargeId');

  const id = chargeId || match?.params.chargeId;

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
      chargeIds: id ? [id] : [],
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
