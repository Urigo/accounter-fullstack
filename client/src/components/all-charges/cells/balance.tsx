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
  const missingLedger = validationData?.missingInfo?.includes(MissingChargeInfo.LedgerRecords);
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Balance) || missingLedger;
  const isBalanced = validationData?.balance?.raw == 0;

  const text = missingLedger
    ? 'Ledger Generation Required'
    : isBalanced
    ? 'Balanced'
    : validationData?.balance?.formatted ?? 'Missing';

  return (
    <td
      style={
        !missingLedger && !isBalanced && validationData?.balance?.formatted
          ? { whiteSpace: 'nowrap' }
          : {}
      }
    >
      <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
        {text}
      </Indicator>
    </td>
  );
};
