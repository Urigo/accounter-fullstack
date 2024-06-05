import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const DocumentsTableVatFieldsFragmentDoc = graphql(`
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
    ... on CreditInvoice {
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
`);

type Props = {
  data: FragmentOf<typeof DocumentsTableVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props): ReactElement => {
  const document = readFragment(DocumentsTableVatFieldsFragmentDoc, data);
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
