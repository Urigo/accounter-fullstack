import { ReactElement, useCallback } from 'react';
import { Indicator } from '@mantine/core';
import {
  Currency,
  DocumentsTableAmountFieldsFragmentDoc,
  DocumentType,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateDocument } from '../../../../hooks/use-update-document.js';
import { ConfirmMiniButton } from '../../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsTableAmountFields on Document {
    id
    documentType
    ... on FinancialDocument {
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

  const shouldHaveAmount = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveAmount && amount?.formatted == null;

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p
              className={[
                'whitespace-nowrap',
                hasAlternative ? 'bg-yellow-400' : '',
                Number(amount?.raw) > 0 ? 'text-green-700' : 'text-red-500',
              ].join(' ')}
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
