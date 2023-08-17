import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import { DocumentType, DocumentTypeFieldsFragmentDoc } from '../../../../gql/graphql';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentTypeFields on Document {
    id
    documentType
  }
`;

type Props = {
  data: FragmentType<typeof DocumentTypeFieldsFragmentDoc>;
};

export const TypeCell = ({ data }: Props) => {
  const { documentType } = getFragmentData(DocumentTypeFieldsFragmentDoc, data);
  const isError = !documentType || documentType === DocumentType.Unprocessed;
  const cellText = documentType ?? 'Missing';

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p>{cellText}</p>
          </Indicator>
        </div>
      </div>
    </td>
  );
};
