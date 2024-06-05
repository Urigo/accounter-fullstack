import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';

export const AllChargesTaxCategoryFieldsFragmentDoc = graphql(`
  fragment AllChargesTaxCategoryFields on Charge {
    __typename
    id
    taxCategory {
      id
      name
    }
    ... on Charge @defer {
      validationData {
        missingInfo
      }
    }
  }
`);

type Props = {
  data: FragmentOf<typeof AllChargesTaxCategoryFieldsFragmentDoc>;
};

export const TaxCategory = ({ data }: Props): ReactElement => {
  const result = readFragment(AllChargesTaxCategoryFieldsFragmentDoc, data);
  const { taxCategory, __typename } = result;
  const validationData = 'validationData' in result ? result.validationData : undefined;

  const shouldHaveTaxCategory = useMemo((): boolean => {
    switch (__typename) {
      case 'DividendCharge':
      case 'InternalTransferCharge':
      case 'SalaryCharge':
      case 'BankDepositCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isError = useMemo(
    () => validationData?.missingInfo?.includes('TAX_CATEGORY'),
    [validationData?.missingInfo],
  );

  if (!shouldHaveTaxCategory) {
    return <td />;
  }

  return (
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        {taxCategory?.name ?? 'N/A'}
      </Indicator>
    </td>
  );
};
