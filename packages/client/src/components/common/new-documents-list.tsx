import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { NewFetchedDocumentFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { getChargeHref } from '../screens/charges/charge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment NewFetchedDocumentFields on Document {
    id
    documentType
    charge {
      id
      userDescription
      counterparty {
        id
        name
      }
    }
  }
`;

export interface Props {
  data: FragmentType<typeof NewFetchedDocumentFieldsFragmentDoc>[];
}

export const NewDocumentsList = ({ data }: Props): ReactElement => {
  const documents = data.map(doc => getFragmentData(NewFetchedDocumentFieldsFragmentDoc, doc));

  return (
    <div className="flex flex-col gap-4 mt-5">
      {documents
        .filter(({ charge }) => charge)
        .map(doc => (
          <Link
            key={doc.id}
            to={getChargeHref(doc.charge!.id)}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
            className="inline-flex items-center font-semibold"
          >
            {`${doc.charge!.counterparty?.name ?? 'Unknown'} - ${doc.charge!.userDescription}`}
          </Link>
        ))}
    </div>
  );
};
