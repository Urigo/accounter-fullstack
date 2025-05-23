import { ReactElement, useCallback, useMemo } from 'react';
import { Indicator, NavLink } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { getBusinessHref } from '../../charges/helpers.js';
import { ConfirmMiniButton } from '../../common/index.js';
import { DocumentsTableRowType } from '../columns.js';

type Props = {
  document: DocumentsTableRowType;
};

export const Debtor = ({ document }: Props): ReactElement => {
  const { get } = useUrlQuery();
  const dbDebtor = 'debtor' in document ? document.debtor : undefined;

  const shouldHaveDebtor = ![DocumentType.Unprocessed, DocumentType.Other].includes(
    document.documentType as DocumentType,
  );
  const isError =
    (shouldHaveDebtor && !dbDebtor?.id) ||
    [DocumentType.Unprocessed].includes(document.documentType as DocumentType);

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessId: string) => getBusinessHref(businessId, encodedFilters as string),
    [encodedFilters],
  );

  const suggestedDebtor = useMemo(() => {
    if (dbDebtor || !('missingInfoSuggestions' in document) || !document.missingInfoSuggestions) {
      // case when creditor is already set or no suggestions
      return undefined;
    }
    const suggestedOwner = document.missingInfoSuggestions.owner;
    const suggestedCounterparty = document.missingInfoSuggestions.counterparty;
    if (document.missingInfoSuggestions?.isIncome == null) {
      // case when we don't know if it's income or expense
      if (document.creditor?.id) {
        const creditorId = document.creditor.id;
        if (suggestedOwner?.id === creditorId && suggestedCounterparty) {
          // case when owner is creditor and we have counterparty
          return suggestedCounterparty;
        }
        if (suggestedCounterparty?.id === creditorId && suggestedOwner) {
          // case when counterparty is creditor and we have owner
          return suggestedOwner;
        }
      }
    } else if (document.missingInfoSuggestions.isIncome && suggestedCounterparty) {
      // case when it's income and we have counterparty
      return suggestedCounterparty;
    } else if (!document.missingInfoSuggestions.isIncome && suggestedOwner) {
      // case when it's expense and we have owner
      return suggestedOwner;
    }
    return undefined;
  }, [document, dbDebtor]);

  const hasAlternative = !dbDebtor && !!suggestedDebtor;

  const debtor = dbDebtor ?? suggestedDebtor;

  const { updateDocument, fetching } = useUpdateDocument();

  const updateDebtor = useCallback(
    (debtorId?: string) => {
      if (debtorId !== undefined) {
        updateDocument({
          documentId: document.id,
          fields: {
            debtorId,
          },
        }).then(document.onUpdate);
      }
    },
    [document.id, updateDocument, document.onUpdate],
  );

  const { name = 'Missing', id } = debtor || {};

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {shouldHaveDebtor &&
            (id ? (
              <a href={getHref(id)} target="_blank" rel="noreferrer">
                <NavLink label={name} className="[&>*>.mantine-NavLink-label]:font-semibold" />
              </a>
            ) : (
              name
            ))}
          {isError && <p className="bg-yellow-400">{name}</p>}
        </Indicator>
      </div>
      {hasAlternative && (
        <ConfirmMiniButton
          onClick={(): void => updateDebtor(suggestedDebtor.id)}
          disabled={fetching}
        />
      )}
    </div>
  );
};
