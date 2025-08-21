import { useCallback, useState, type ReactElement } from 'react';
import { CheckIcon } from 'lucide-react';
import {
  TransactionsTableEntityFieldsFragmentDoc,
  type ChargeFilter,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { getBusinessTransactionsHref } from '../../business-transactions/index.js';
import { SelectWithSearch, Tooltip } from '../../common/index.js';
import { InsertBusiness } from '../../common/modals/insert-business.js';
import { SimilarTransactionsModal } from '../../common/modals/similar-transactions-modal.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableEntityFields on Transaction {
    id
    counterparty {
      name
      id
    }
    sourceDescription
    missingInfoSuggestions {
      business {
        id
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableEntityFieldsFragmentDoc>;
  enableEdit?: boolean;
  onChange?: () => void;
};

export function Counterparty({ data, onChange, enableEdit }: Props): ReactElement {
  const { get } = useUrlQuery();
  const {
    id,
    counterparty,
    missingInfoSuggestions,
    id: transactionId,
    sourceDescription,
  } = getFragmentData(TransactionsTableEntityFieldsFragmentDoc, data);

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
    <td>
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
    </td>
  );
}
