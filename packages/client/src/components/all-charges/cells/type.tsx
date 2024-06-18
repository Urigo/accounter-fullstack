import { ReactElement, useMemo } from 'react';
import {
  Coin,
  CreditCard,
  Gift,
  PigMoney,
  Plane,
  ReceiptTax,
  TransferIn,
  Transform,
  Wallet,
} from 'tabler-icons-react';
import { ThemeIcon } from '@mantine/core';
import { AllChargesTypeFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesTypeFields on Charge {
    __typename
    id
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesTypeFieldsFragmentDoc>;
};

export const TypeCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesTypeFieldsFragmentDoc, data);
  const { __typename } = charge;

  const type = useMemo((): {
    text: string;
    icon: ReactElement;
  } => {
    switch (__typename) {
      case 'CommonCharge':
        return { text: 'Common', icon: <Coin /> };
      case 'BusinessTripCharge':
        return { text: 'Business Trip', icon: <Plane /> };
      case 'DividendCharge':
        return { text: 'Dividend', icon: <Gift /> };
      case 'ConversionCharge':
        return { text: 'Conversion', icon: <Transform /> };
      case 'SalaryCharge':
        return { text: 'Salary', icon: <Wallet /> };
      case 'InternalTransferCharge':
        return { text: 'Internal Transfer', icon: <TransferIn /> };
      case 'MonthlyVatCharge':
        return { text: 'Monthly VAT', icon: <ReceiptTax /> };
      case 'BankDepositCharge':
        return { text: 'Bank Deposit', icon: <PigMoney /> };
      case 'CreditcardBankCharge':
        return { text: 'Credit Card Bank Charge', icon: <CreditCard /> };
      default:
        return { text: 'Unknown', icon: <Coin /> };
    }
  }, [__typename]);
  return (
    <td>
      <div>{type.text}</div>
      <ThemeIcon radius="xl" size="xl">
        {type.icon}
      </ThemeIcon>
    </td>
  );
};
