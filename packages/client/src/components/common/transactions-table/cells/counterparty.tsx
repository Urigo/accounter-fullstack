import { ReactElement, useCallback } from 'react';
import { CheckIcon } from 'lucide-react';
// import { NavLink } from '@mantine/core';
import { ChargeFilter, TransactionsTableEntityFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateTransaction } from '../../../../hooks/use-update-transaction.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { InsertBusiness } from '../../../common/modals/insert-business.js';
import { Tooltip } from '../../../common/tooltip.js';
import { Button } from '../../../ui/button.js';
// import { ConfirmMiniButton, InsertBusiness } from '../../../common/index.js';
import { SelectWithSearch } from '../../../ui/select-with-search.js';

const frameworks = [
  {
    value: 'next.js',
    label: 'Next.js',
  },
  {
    value: 'sveltekit',
    label: 'SvelteKit',
  },
  {
    value: 'nuxt.js',
    label: 'Nuxt.js',
  },
  {
    value: 'remix',
    label: 'Remix',
  },
  {
    value: 'astro',
    label: 'Astro',
  },
  {
    value: 'angular',
    label: 'Angular',
  },
  {
    value: 'vue',
    label: 'Vue.js',
  },
  {
    value: 'react',
    label: 'React',
  },
  {
    value: 'ember',
    label: 'Ember.js',
  },
  {
    value: 'gatsby',
    label: 'Gatsby',
  },
  {
    value: 'eleventy',
    label: 'Eleventy',
  },
  {
    value: 'solid',
    label: 'SolidJS',
  },
  {
    value: 'preact',
    label: 'Preact',
  },
  {
    value: 'qwik',
    label: 'Qwik',
  },
  {
    value: 'alpine',
    label: 'Alpine.js',
  },
  {
    value: 'lit',
    label: 'Lit',
  },
];

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

  const hasAlternative = !!missingInfoSuggestions?.business && enableEdit;
  const alternativeName = hasAlternative ? missingInfoSuggestions?.business?.name : 'Missing';
  const alternativeId = hasAlternative ? missingInfoSuggestions?.business?.id : null;

  const name = counterparty?.name ?? alternativeName;
  const id = counterparty?.id ?? alternativeId;

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

  // const content = <p className={hasAlternative ? 'bg-yellow-400' : undefined}>{name}</p>;

  return (
    <td>
      <div className="flex flex-wrap gap-1 items-center justify-center">
        {id ? (
          <p className={hasAlternative ? 'bg-yellow-400' : undefined}>{name}</p>
        ) : (
          <>
            <SelectWithSearch
              options={frameworks}
              placeholder="Choose or create a business"
              empty={<InsertBusiness description={sourceDescription} />}
            />
            <Tooltip content="Add business">
              <Button variant="outline" size="icon">
                <CheckIcon className="size-4" />
              </Button>
            </Tooltip>
          </>
        )}
        {/* {id && (
          <>
            <a href={getHref(id)} target="_blank" rel="noreferrer">
              <NavLink label={content} className="[&>*>.mantine-NavLink-label]:font-semibold" />
            </a>
            {hasAlternative && (
              <ConfirmMiniButton
                onClick={(): void => updateBusiness(missingInfoSuggestions.business.id)}
                disabled={fetching}
              />
            )}
          </>
        )}
        {!id && sourceDescription !== '' && <InsertBusiness description={sourceDescription} />} */}
      </div>
    </td>
  );
}
