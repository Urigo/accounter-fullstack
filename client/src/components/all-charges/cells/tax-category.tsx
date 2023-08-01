import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesTaxCategoryFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';

/* GraphQL */ `
  fragment AllChargesTaxCategoryFields on Charge {
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

export const TaxCategory = ({ data }: Props) => {
  const { validationData, taxCategory } = getFragmentData(
    AllChargesTaxCategoryFieldsFragmentDoc,
    data,
  );
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.TaxCategory);

  return (
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        {taxCategory?.name ?? 'N/A'}
      </Indicator>
    </td>
  );
};
