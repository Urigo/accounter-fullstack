import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import {
  AllChargesVatFieldsFragmentDoc,
  Currency,
  MissingChargeInfo,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesVatFields on Charge {
    __typename
    id
    ... on Charge @defer {
      vat {
        raw
        formatted
      }
      totalAmount {
        raw
        currency
      }
      validationData {
        missingInfo
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props): ReactElement => {
  const { vat, totalAmount, validationData, __typename } = getFragmentData(
    AllChargesVatFieldsFragmentDoc,
    data,
  );

  const shouldHaveVat = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'DividendCharge':
      case 'ConversionCharge':
      case 'SalaryCharge':
      case 'InternalTransferCharge':
      case 'BankDepositCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  if (!shouldHaveVat) {
    return <td />;
  }

  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Vat);

  const isLocalCurrencyButNoVat = !vat && totalAmount?.currency === Currency.Ils;
  const vatIsNegativeToAmount =
    ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
    ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0);

  const vatIssueFlag = isLocalCurrencyButNoVat || vatIsNegativeToAmount;

  return (
    <td>
      <div style={{ color: vatIssueFlag ? 'red' : 'green', whiteSpace: 'nowrap' }}>
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {vat ? vat.formatted : vatIssueFlag ? 'Missing' : null}
        </Indicator>
      </div>
    </td>
  );
};
