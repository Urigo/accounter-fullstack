import { useCallback } from 'react';
import { Indicator, NavLink } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import {
  AllChargesEntityFieldsFragmentDoc,
  ChargeFilter,
  MissingChargeInfo,
} from '../../../gql/graphql';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { ConfirmMiniButton } from '../../common';

/* GraphQL */ `
  fragment AllChargesEntityFields on Charge {
    id
    counterparty {
      name
      id
    }
    validationData {
      missingInfo
    }
    missingInfoSuggestions {
      business {
        id
        name
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesEntityFieldsFragmentDoc>;
};

export const Entity = ({ data }: Props) => {
  const { get } = useUrlQuery();
  const {
    counterparty,
    id: chargeId,
    validationData,
    missingInfoSuggestions,
  } = getFragmentData(AllChargesEntityFieldsFragmentDoc, data);
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Counterparty);
  const hasAlternative = isError && missingInfoSuggestions?.business;
  const { name, id } = counterparty || {};
  const alternativeName = hasAlternative ? missingInfoSuggestions.business.name : 'Missing';
  const cellText = isError ? alternativeName : name;

  const { updateCharge, fetching } = useUpdateCharge();

  const updateTag = useCallback(
    (businessID?: string) => {
      if (businessID !== undefined) {
        updateCharge({
          chargeId,
          fields: {
            counterparty: {
              id: businessID,
            },
          },
        });
      }
    },
    [chargeId, updateCharge],
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
      return `/business-transactions?transactionsFilters=%257B%2522financialEntityIds%2522%253A%255B${
        encodedNewFilters.financialEntityIds
      }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
        encodedNewFilters.fromDate
      }${encodedNewFilters.toDate}%257D`;
    },
    [encodedFilters],
  );

  const content = (
    <p style={hasAlternative ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}>{cellText}</p>
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {!isError && (
            <a href={getHref(id)} target="_blank" rel="noreferrer">
              <NavLink label={content} className="[&>*>.mantine-NavLink-label]:font-semibold" />
            </a>
          )}
          {isError && content}
        </Indicator>
        {hasAlternative && (
          <ConfirmMiniButton
            onClick={() => updateTag(missingInfoSuggestions.business.id)}
            disabled={fetching}
          />
        )}
      </div>
    </td>
  );
};
