import { ReactElement, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { ChargeScreenDocument } from '../../../gql/graphql.js';
import { ChargesTable } from '../../charges/charges-table.js';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
} from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeScreen($chargeIds: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIds) {
      id
      ...ChargesTableFields
    }
  }
`;

export function getChargeHref(chargeId: string): string {
  return `/charges/${chargeId}`;
}

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
        <ChargesTable
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
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
