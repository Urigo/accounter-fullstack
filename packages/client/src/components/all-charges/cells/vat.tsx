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
    vat {
      raw
      formatted
    }
    totalAmount {
      raw
      currency
    }
    ... on Charge @defer {
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

  const isError = useMemo(
    () => validationData?.missingInfo?.includes(MissingChargeInfo.Vat),
    [validationData?.missingInfo],
  );
  const isLocalCurrencyButNoVat = useMemo(
    () => !vat && totalAmount?.currency === Currency.Ils,
    [vat, totalAmount?.currency],
  );
  const vatIsNegativeToAmount = useMemo(
    () =>
      ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
      ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0),
    [vat?.raw, totalAmount?.raw],
  );
  const vatIssueFlag = isLocalCurrencyButNoVat || vatIsNegativeToAmount;

  const shouldHaveVat = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'DividendCharge':
      case 'ConversionCharge':
      case 'SalaryCharge':
      case 'InternalTransferCharge':
      case 'BankDepositCharge':
      case 'CreditcardBankCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  if (!shouldHaveVat) {
    return <td />;
  }

  return (
    <td>
      <div
        className={
          vatIssueFlag ? 'whitespace-nowrap text-red-500' : 'whitespace-nowrap text-green-700'
        }
      >
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {vat?.formatted}
        </Indicator>
      </div>
    </td>
  );
};
