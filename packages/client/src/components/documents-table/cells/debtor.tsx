import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useGetBusinesses } from '@/hooks/use-get-businesses.js';
import { Indicator } from '@mantine/core';
import { DocumentType } from '../../../gql/graphql.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { getBusinessHref } from '../../charges/helpers.js';
import { ConfirmMiniButton, InsertBusiness, SelectWithSearch } from '../../common/index.js';
import type { DocumentsTableRowType } from '../columns.js';
import { COUNTERPARTIES_LESS_DOCUMENT_TYPES } from './index.js';

type Props = {
  document: DocumentsTableRowType;
  onChange?: () => void;
};

export const Debtor = ({ document, onChange }: Props): ReactElement => {
  const { get } = useUrlQuery();
  const dbDebtor = 'debtor' in document ? document.debtor : undefined;

  const shouldHaveDebtor =
    !document.documentType || !COUNTERPARTIES_LESS_DOCUMENT_TYPES.includes(document.documentType);
  const isError =
    (shouldHaveDebtor && !dbDebtor?.id) || DocumentType.Unprocessed === document.documentType;

  const { selectableBusinesses, refresh: refreshBusinesses } = useGetBusinesses();

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
  const { name = 'Missing', id } = debtor || {};

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

  const [search, setSearch] = useState<string | null>(null);

  const onAddBusiness = useCallback(
    async (businessId: string) => {
      await updateDebtor(businessId);
      refreshBusinesses();
      onChange?.();
    },
    [updateDebtor, onChange, refreshBusinesses],
  );

  return (
    <div className="flex flex-wrap">
      <div className="flex flex-col justify-center">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {shouldHaveDebtor &&
            (id ? (
              <Link
                to={getHref(id)}
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
                onChange={businessId => businessId && updateDebtor(businessId)}
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
          onClick={(): void => updateDebtor(suggestedDebtor.id)}
          disabled={fetching}
        />
      )}
    </div>
  );
};
