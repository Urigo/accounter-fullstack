import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import { DocumentSerialFieldsFragmentDoc } from '../../../../gql/graphql';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentSerialFields on Document {
    id
    ... on Invoice {
      serialNumber
    }
    ... on InvoiceReceipt {
      serialNumber
    }
    ... on Proforma {
      serialNumber
    }
    ... on Receipt {
      serialNumber
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentSerialFieldsFragmentDoc>;
};

export const Serial = ({ data }: Props) => {
  const document = getFragmentData(DocumentSerialFieldsFragmentDoc, data);
  const serialNumber = 'serialNumber' in document ? document.serialNumber : undefined;

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!!serialNumber} color="red" zIndex="auto">
            <p>{serialNumber}</p>
          </Indicator>
        </div>
      </div>
    </td>
  );
};
