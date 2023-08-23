import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { DocumentsTableVatFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
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

export const Vat = ({ data }: Props): ReactElement => {
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
