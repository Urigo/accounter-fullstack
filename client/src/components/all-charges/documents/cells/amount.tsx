import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../../gql';
import { DocumentsTableAmountFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment DocumentsTableAmountFields on Document {
    id
    ... on Invoice {
      amount {
        raw
        formatted
        currency
      }
    }
    ... on InvoiceReceipt {
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Proforma {
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Receipt {
      amount {
        raw
        formatted
        currency
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentsTableAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props) => {
  const document = getFragmentData(DocumentsTableAmountFieldsFragmentDoc, data);
  const amount = 'amount' in document ? document.amount : undefined;

  return (
    <td>
      <Indicator inline size={12} disabled={amount?.formatted == null} color="red" zIndex="auto">
        <div
          style={{
            color: Number(amount?.raw) > 0 ? 'green' : 'red',
            whiteSpace: 'nowrap',
          }}
        >
          {amount?.formatted}
        </div>
      </Indicator>
    </td>
  );
};
