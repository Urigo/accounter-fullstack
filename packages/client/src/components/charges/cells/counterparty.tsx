import { useMemo, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Indicator } from '@mantine/core';
import { ROUTES } from '@/router/routes.js';
import { ChargesTableEntityFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';

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

  return (
    <td>
      <div className="flex flex-wrap">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {!isError && id && (
            <Link
              to={ROUTES.BUSINESSES.DETAIL(id)}
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
