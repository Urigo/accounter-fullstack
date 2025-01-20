import { ReactElement, useCallback, useMemo, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { useQuery } from 'urql';
import {
  AllBusinessesDocument,
  ChargeFilter,
  TransactionsTableEntityFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateTransaction } from '../../../../hooks/use-update-transaction.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { InsertBusiness } from '../../../common/modals/insert-business.js';
import { Button } from '../../../ui/button.js';
// import { ConfirmMiniButton, InsertBusiness } from '../../../common/index.js';
import { SelectWithSearch } from '../../../ui/select-with-search.js';
import { ContentTooltip } from '../../../ui/tooltip.js';

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
    counterparty,
    missingInfoSuggestions,
    id: transactionId,
    sourceDescription,
  } = getFragmentData(TransactionsTableEntityFieldsFragmentDoc, data);

  const hasSuggestion = !!missingInfoSuggestions?.business && enableEdit;
  const suggestedName = hasSuggestion ? missingInfoSuggestions?.business?.name : 'Missing';
  const suggestedId = hasSuggestion ? missingInfoSuggestions?.business?.id : null;

  const name = counterparty?.name ?? suggestedName;

  const { updateTransaction, fetching } = useUpdateTransaction();
  const updateBusiness = useCallback(
    (counterpartyId: string) => {
      updateTransaction({
        transactionId,
        fields: {
          counterpartyId,
        },
      }).then(onChange);
    },
    [transactionId, updateTransaction, onChange],
  );

  const encodedFilters = get('chargesFilters');

  const getHref = useCallback(
    (businessID: string) => {
      const currentFilters = encodedFilters
        ? (JSON.parse(decodeURIComponent(encodedFilters as string)) as ChargeFilter)
        : {};
      const encodedNewFilters = {
        fromDate: currentFilters.fromDate
          ? `%252C%2522fromDate%2522%253A%2522${currentFilters.fromDate}%2522`
          : '',
        toDate: currentFilters.toDate
          ? `%252C%2522toDate%2522%253A%2522${currentFilters.toDate}%2522`
          : '',
        financialEntityIds:
          currentFilters.byOwners && currentFilters.byOwners.length > 0
            ? `%2522${currentFilters.byOwners.join('%2522%252C%2522')}%2522`
            : '',
      };
      return `/business-transactions?transactionsFilters=%257B%2522ownerIds%2522%253A%255B${
        encodedNewFilters.financialEntityIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  const [{ data: businessesData }] = useQuery({ query: AllBusinessesDocument });

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(suggestedId ?? null);

  const [search, setSearch] = useState<string | null>(sourceDescription);

  const selectOptions = useMemo(
    () =>
      businessesData?.allBusinesses?.nodes.map(node => ({
        value: node.id,
        label: node.name,
      })) || [],
    [businessesData],
  );

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
              empty={search ? <InsertBusiness description={search} onAdd={updateBusiness} /> : null}
            />
            <ContentTooltip content="Approve">
              <Button
                variant="outline"
                size="icon"
                onClick={() => selectedBusinessId && updateBusiness(selectedBusinessId)}
                disabled={fetching || !selectedBusinessId}
              >
                <CheckIcon className="size-4" />
              </Button>
            </ContentTooltip>
          </>
        )}
      </div>
    </td>
  );
}
