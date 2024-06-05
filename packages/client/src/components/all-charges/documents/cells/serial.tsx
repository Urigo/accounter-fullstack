import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const DocumentSerialFieldsFragmentDoc = graphql(`
  fragment DocumentSerialFields on Document {
    id
    ... on Invoice {
      serialNumber
    }
    ... on InvoiceReceipt {
      serialNumber
    }
    ... on CreditInvoice {
      serialNumber
    }
    ... on Proforma {
      serialNumber
    }
    ... on Receipt {
      serialNumber
    }
  }
`);

type Props = {
  data: FragmentOf<typeof DocumentSerialFieldsFragmentDoc>;
};

export const Serial = ({ data }: Props): ReactElement => {
  const document = readFragment(DocumentSerialFieldsFragmentDoc, data);
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
