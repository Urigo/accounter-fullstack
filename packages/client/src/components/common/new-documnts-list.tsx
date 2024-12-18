import { ReactElement } from 'react';
import { NavLink } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../gql';
import { NewFetchedDocumentFieldsFragmentDoc } from '../../gql/graphql';

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
          <NavLink
            key={doc.id}
            label={`${doc.charge!.counterparty?.name ?? 'Unknown'} - ${doc.charge!.userDescription}`}
            onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
              event.stopPropagation();
              window.open(`/charges/${doc.charge!.id}`, '_blank', 'noreferrer');
            }}
          />
        ))}
    </div>
  );
};
