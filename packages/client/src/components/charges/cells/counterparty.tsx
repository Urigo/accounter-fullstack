import { useCallback, useMemo, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Indicator } from '@mantine/core';
import {
  ChargesTableEntityFieldsFragmentDoc,
  MissingChargeInfo,
  type ChargeFilter,
} from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { getBusinessTransactionsHref } from '../../business-transactions/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableEntityFields on Charge {
    __typename
    id
    counterparty {
      name
      id
    }
    ... on Charge @defer {
      validationData {
        missingInfo
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableEntityFieldsFragmentDoc>;
};

export const Counterparty = ({ data }: Props): ReactElement => {
  const { get } = useUrlQuery();
  const { counterparty, validationData, __typename } = getFragmentData(
    ChargesTableEntityFieldsFragmentDoc,
    data,
  );

  const shouldHaveCounterparty = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'DividendCharge':
      case 'ConversionCharge':
      case 'SalaryCharge':
      case 'InternalTransferCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isError = useMemo(
    () =>
      shouldHaveCounterparty &&
      validationData?.missingInfo?.includes(MissingChargeInfo.Counterparty),
    [shouldHaveCounterparty, validationData?.missingInfo],
  );
  const { name, id } = counterparty ?? { name: 'Missing', id: undefined };

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

  return (
    <td>
      <div className="flex flex-wrap">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {!isError && id && (
            <Link
              to={getHref(id)}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              className="inline-flex items-center font-semibold"
            >
              {name}
            </Link>
          )}
          {isError && name}
        </Indicator>
      </div>
    </td>
  );
};
