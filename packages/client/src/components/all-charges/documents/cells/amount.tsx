import { ReactElement, useCallback } from 'react';
import { Indicator } from '@mantine/core';
import { Currency, DocumentsTableAmountFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateDocument } from '../../../../hooks/use-update-document.js';
import { ConfirmMiniButton } from '../../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsTableAmountFields on Document {
    id
    ... on Invoice {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
      }
    }
    ... on InvoiceReceipt {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
      }
    }
    ... on Proforma {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
      }
    }
    ... on Receipt {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
      }
    }
    ... on CreditInvoice {
      amount {
        raw
        formatted
        currency
      }
      missingInfoSuggestions {
        amount {
          raw
          formatted
          currency
        }
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof DocumentsTableAmountFieldsFragmentDoc>;
  refetchDocument: () => void;
};

export const Amount = ({ data, refetchDocument }: Props): ReactElement => {
  const document = getFragmentData(DocumentsTableAmountFieldsFragmentDoc, data);
  const dbAmount = 'amount' in document ? document.amount : undefined;

  const suggestedAmount =
    'missingInfoSuggestions' in document ? document.missingInfoSuggestions?.amount : undefined;
  const hasAlternative = !dbAmount && !!suggestedAmount;

  const amount = dbAmount ?? suggestedAmount;

  const { updateDocument, fetching } = useUpdateDocument();

  const updateAmount = useCallback(
    (amount?: { raw: number; currency: Currency }) => {
      if (amount !== undefined) {
        updateDocument({
          documentId: document.id,
          fields: {
            amount: {
              raw: amount.raw,
              currency: amount.currency,
            },
          },
        }).then(refetchDocument);
      }
    },
    [document.id, updateDocument, refetchDocument],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator
            inline
            size={12}
            disabled={amount?.formatted != null}
            color="red"
            zIndex="auto"
          >
            <p
              style={{
                color: Number(amount?.raw) > 0 ? 'green' : 'red',
                whiteSpace: 'nowrap',
                backgroundColor: hasAlternative ? 'rgb(236, 207, 57)' : undefined,
              }}
            >
              {amount?.formatted}
            </p>
          </Indicator>
        </div>
        {hasAlternative && (
          <ConfirmMiniButton
            onClick={(): void => updateAmount(suggestedAmount)}
            disabled={fetching}
          />
        )}
      </div>
    </td>
  );
};
