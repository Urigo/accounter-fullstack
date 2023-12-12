import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import {
  AllChargesVatFieldsFragmentDoc,
  Currency,
  MissingChargeInfo,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { businessesWithoutTaxCategory, entitiesWithoutInvoice } from '../../../helpers';

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
    counterparty {
      id
    }
    owner {
      __typename
      id
    }
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props): ReactElement => {
  const { vat, totalAmount, counterparty, owner, validationData, __typename } = getFragmentData(
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
        return false;
      default:
        return true;
    }
  }, [__typename]);

  if (!shouldHaveVat) {
    return <td />;
  }

  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Vat);
  const isBusiness = owner?.__typename === 'LtdFinancialEntity';

  const vatIssueFlag =
    (!vat &&
      isBusiness &&
      !entitiesWithoutInvoice.includes(counterparty?.id ?? '') &&
      !businessesWithoutTaxCategory.includes(counterparty?.id ?? '') &&
      totalAmount?.currency === Currency.Ils) ||
    ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
    ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0);

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
