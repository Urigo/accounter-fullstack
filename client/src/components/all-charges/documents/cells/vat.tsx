import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import { DocumentsTableVatFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment DocumentsTableVatFields on Document {
    id
    ... on Invoice {
      vat {
        raw
        formatted
        currency
      }
    }
    ... on InvoiceReceipt {
      vat {
        raw
        formatted
        currency
      }
    }
    ... on Proforma {
      vat {
        raw
        formatted
        currency
      }
    }
    ... on Receipt {
      vat {
        raw
        formatted
        currency
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentsTableVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props) => {
  const document = getFragmentData(DocumentsTableVatFieldsFragmentDoc, data);
  const vat = 'vat' in document ? document.vat : undefined;

  return (
    <td>
      <Indicator inline size={12} disabled={vat?.formatted != null} color="red" zIndex="auto">
        <div
          style={{
            color: Number(vat?.raw) > 0 ? 'green' : 'red',
            whiteSpace: 'nowrap',
          }}
        >
          {vat?.formatted}
        </div>
      </Indicator>
    </td>
  );
};
