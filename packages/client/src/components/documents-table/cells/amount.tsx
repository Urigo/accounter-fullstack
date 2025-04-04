import { ReactElement, useCallback } from 'react';
import { Indicator } from '@mantine/core';
import { Currency, DocumentType } from '../../../gql/graphql.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { ConfirmMiniButton } from '../../common/index.js';
import { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Amount = ({ document }: Props): ReactElement => {
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
        }).then(document.onUpdate);
      }
    },
    [document.id, updateDocument, document.onUpdate],
  );

  const shouldHaveAmount = ![DocumentType.Other].includes(document.documentType as DocumentType);
  const isError = shouldHaveAmount && amount?.formatted == null;

  return (
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
  );
};
