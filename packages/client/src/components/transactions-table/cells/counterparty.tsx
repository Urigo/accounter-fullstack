import { useCallback, useState, type ReactElement } from 'react';
import { CheckIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { SelectWithSearch, Tooltip } from '../../common/index.js';
import { InsertBusiness } from '../../common/modals/insert-business.jsx';
import { SimilarTransactionsModal } from '../../common/modals/similar-transactions-modal.jsx';
import { Button } from '../../ui/button.jsx';
import type { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
  onChange?: () => void;
};

export function Counterparty({ transaction, onChange }: Props): ReactElement {
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

  const { selectableBusinesses: selectOptions, fetching: businessesLoading } = useGetBusinesses();

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(suggestedId ?? null);

  const [search, setSearch] = useState<string | null>(sourceDescription);

  return (
    <>
      <div className="flex flex-wrap flex-col justify-center">
        {counterparty?.id ? (
          <Link
            to={ROUTES.BUSINESSES.DETAIL(counterparty.id)}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
            className="inline-flex items-center font-semibold"
          >
            {name}
          </Link>
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
