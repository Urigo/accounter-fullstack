import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { AllChargesTaxCategoryFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesTaxCategoryFields on Charge {
    __typename
    id
    taxCategory {
        id
        name
    }
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesTaxCategoryFieldsFragmentDoc>;
};

export const TaxCategory = ({ data }: Props): ReactElement => {
  const { validationData, taxCategory, __typename } = getFragmentData(
    AllChargesTaxCategoryFieldsFragmentDoc,
    data,
  );

  const shouldHaveTaxCategory = useMemo((): boolean => {
    switch (__typename) {
      case 'DividendCharge':
      case 'InternalTransferCharge':
      case 'SalaryCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  if (!shouldHaveTaxCategory) {
    return <td />;
  }

  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.TaxCategory);

  return (
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        {taxCategory?.name ?? 'N/A'}
      </Indicator>
    </td>
  );
};
