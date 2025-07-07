import { ReactElement, useCallback, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { ChargeFilter } from '../../../gql/graphql.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { getBusinessTransactionsHref } from '../../business-transactions/index.js';
import { Tooltip } from '../../common/index.js';
import { InsertBusiness } from '../../common/modals/insert-business.jsx';
import { SimilarTransactionsModal } from '../../common/modals/similar-transactions-modal.jsx';
import { Button } from '../../ui/button.jsx';
import { SelectWithSearch } from '../../ui/select-with-search.jsx';
import { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
  onChange?: () => void;
};

export function Counterparty({ transaction, onChange }: Props): ReactElement {
  const { get } = useUrlQuery();
  const {
    id,
    counterparty,
    missingInfoSuggestions,
    id: transactionId,
    sourceDescription,
    enableEdit,
  } = transaction;

  const hasSuggestion = !!missingInfoSuggestions?.business && enableEdit;
  const suggestedName = hasSuggestion ? missingInfoSuggestions?.business?.name : 'Missing';
  const suggestedId = hasSuggestion ? missingInfoSuggestions?.business?.id : null;

  const name = counterparty?.name ?? suggestedName;

  const [similarTransactionsOpen, setSimilarTransactionsOpen] = useState(false);

  const { updateTransaction, fetching } = useUpdateTransaction();
  const updateBusiness = useCallback(
    async (counterpartyId: string) => {
      await updateTransaction({
        transactionId,
        fields: {
          counterpartyId,
        },
      });
      setSimilarTransactionsOpen(true);
    },
    [transactionId, updateTransaction],
  );

  const onAddBusiness = useCallback(
    async (businessId: string) => {
      await updateBusiness(businessId);
      onChange?.();
    },
    [updateBusiness, onChange],
  );

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessID: string) => {
      const currentFilters = encodedFilters
        ? (JSON.parse(decodeURIComponent(encodedFilters as string)) as ChargeFilter)
        : {};

      return getBusinessTransactionsHref({
        fromDate: currentFilters.fromDate,
        toDate: currentFilters.toDate,
        ownerIds: currentFilters.byOwners,
        businessIDs: [businessID],
      });
    },
    [encodedFilters],
  );

  const { selectableBusinesses: selectOptions, fetching: businessesLoading } = useGetBusinesses();

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(suggestedId ?? null);

  const [search, setSearch] = useState<string | null>(sourceDescription);

  return (
    <>
      <div className="flex flex-wrap gap-1 items-center justify-center">
        {counterparty?.id ? (
          <a href={getHref(counterparty.id)} target="_blank" rel="noreferrer">
            {name}
          </a>
        ) : (
          <>
            <SelectWithSearch
              options={selectOptions}
              value={selectedBusinessId}
              onChange={setSelectedBusinessId}
              search={search}
              onSearchChange={setSearch}
              placeholder="Choose or create a business"
              empty={search ? <InsertBusiness description={search} onAdd={onAddBusiness} /> : null}
            />
            <Tooltip content="Approve">
              <Button
                variant="outline"
                size="icon"
                onClick={() => selectedBusinessId && updateBusiness(selectedBusinessId)}
                disabled={fetching || businessesLoading || !selectedBusinessId}
              >
                <CheckIcon className="size-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      <SimilarTransactionsModal
        transactionId={id}
        counterpartyId={counterparty?.id ?? selectedBusinessId}
        open={similarTransactionsOpen}
        onOpenChange={setSimilarTransactionsOpen}
        onClose={onChange}
      />
    </>
  );
}
