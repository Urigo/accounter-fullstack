import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Indicator } from '@mantine/core';
import { DocumentType } from '@/gql/graphql.js';
import { useGetBusinesses } from '@/hooks/use-get-businesses.js';
import { useUpdateDocument } from '@/hooks/use-update-document.js';
import { ROUTES } from '@/router/routes.js';
import { ConfirmMiniButton, InsertBusiness, SelectWithSearch } from '../../common/index.js';
import type { DocumentsTableRowType } from '../columns.js';

export const COUNTERPARTIES_LESS_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.Unprocessed,
  DocumentType.Other,
] as const;

type Props = {
  document: DocumentsTableRowType;
  onChange?: () => void;
};

export const Creditor = ({ document, onChange }: Props): ReactElement => {
  const dbCreditor = 'creditor' in document ? document.creditor : undefined;

  const shouldHaveCreditor =
    !document.documentType || !COUNTERPARTIES_LESS_DOCUMENT_TYPES.includes(document.documentType);
  const isError =
    (shouldHaveCreditor && !dbCreditor?.id) || DocumentType.Unprocessed === document.documentType;

  const { selectableBusinesses, refresh: refreshBusinesses } = useGetBusinesses();

  const suggestedCreditor = useMemo(() => {
    if (dbCreditor || !('missingInfoSuggestions' in document) || !document.missingInfoSuggestions) {
      // case when creditor is already set or no suggestions
      return undefined;
    }
    const suggestedOwner = document.missingInfoSuggestions.owner;
    const suggestedCounterparty = document.missingInfoSuggestions.counterparty;
    if (document.missingInfoSuggestions?.isIncome == null) {
      // case when we don't know if it's income or expense
      if (document.debtor?.id) {
        const debtorId = document.debtor.id;
        if (suggestedOwner?.id === debtorId && suggestedCounterparty) {
          // case when owner is debtor and we have counterparty
          return suggestedCounterparty;
        }
        if (suggestedCounterparty?.id === debtorId && suggestedOwner) {
          // case when counterparty is debtor and we have owner
          return suggestedOwner;
        }
      }
    } else if (document.missingInfoSuggestions.isIncome && suggestedOwner) {
      // case when it's income and we have owner
      return suggestedOwner;
    } else if (!document.missingInfoSuggestions.isIncome && suggestedCounterparty) {
      // case when it's expense and we have counterparty
      return suggestedCounterparty;
    }
    return undefined;
  }, [document, dbCreditor]);

  const hasAlternative = !dbCreditor && !!suggestedCreditor;

  const creditor = dbCreditor ?? suggestedCreditor;
  const { name = 'Missing', id } = creditor || {};

  const { updateDocument, fetching } = useUpdateDocument();

  const updateCreditor = useCallback(
    (creditorId?: string) => {
      if (creditorId !== undefined) {
        updateDocument({
          documentId: document.id,
          fields: {
            creditorId,
          },
        }).then(document.onUpdate);
      }
    },
    [document.id, updateDocument, document.onUpdate],
  );

  const [search, setSearch] = useState<string | null>(null);

  const onAddBusiness = useCallback(
    async (businessId: string) => {
      await updateCreditor(businessId);
      refreshBusinesses();
      onChange?.();
    },
    [updateCreditor, onChange, refreshBusinesses],
  );

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center whitespace-normal">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {shouldHaveCreditor &&
            (id ? (
              <Link
                to={ROUTES.BUSINESSES.DETAIL(id)}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="inline-flex items-center font-semibold"
              >
                {name}
              </Link>
            ) : (
              <SelectWithSearch
                options={selectableBusinesses}
                value={id ?? null}
                onChange={businessId => businessId && updateCreditor(businessId)}
                search={search}
                onSearchChange={setSearch}
                placeholder="Choose or create a business"
                empty={
                  search ? <InsertBusiness description={search} onAdd={onAddBusiness} /> : null
                }
              />
            ))}
        </Indicator>
      </div>
      {hasAlternative && (
        <ConfirmMiniButton
          onClick={(): void => updateCreditor(suggestedCreditor.id)}
          disabled={fetching}
        />
      )}
    </div>
  );
};
