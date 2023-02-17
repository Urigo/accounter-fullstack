import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesBalanceFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';

/* GraphQL */ `
  fragment AllChargesBalanceFields on Charge {
    id
    validationData {
      missingInfo
      balance {
        raw
        formatted
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesBalanceFieldsFragmentDoc>;
};

export const Balance = ({ data }: Props) => {
  const { validationData } = getFragmentData(AllChargesBalanceFieldsFragmentDoc, data);
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Balance);

  return (
    <td>
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        {validationData?.balance?.raw == 0
          ? 'Balanced'
          : validationData?.balance?.formatted ?? 'Missing'}
      </Indicator>
    </td>
  );
};
