import { type ReactElement } from 'react';
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
    validationData {
      missingInfo
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

  const noRequiredCounterpartyChargeTypes: Array<typeof __typename> = [
    'BusinessTripCharge',
    'DividendCharge',
    'ConversionCharge',
    'SalaryCharge',
    'InternalTransferCharge',
  ];

  const shouldHaveCounterparty = !noRequiredCounterpartyChargeTypes.includes(__typename);

  const isError =
    shouldHaveCounterparty && validationData?.missingInfo?.includes(MissingChargeInfo.Counterparty);
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
