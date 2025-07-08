import { ReactElement, useMemo } from 'react';
import {
  Coin,
  CreditCard,
  Gift,
  PigMoney,
  Plane,
  ReceiptTax,
  Scale,
  TransferIn,
  Transform,
  Wallet,
} from 'tabler-icons-react';
import { ThemeIcon } from '@mantine/core';
import { ChargesTableTypeFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { getChargeTypeName } from '../../../helpers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableTypeFields on Charge {
    __typename
    id
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableTypeFieldsFragmentDoc>;
};

export const TypeCell = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(ChargesTableTypeFieldsFragmentDoc, data);
  const { __typename } = charge;

  const { text, icon } = useMemo((): {
    text: string;
    icon: ReactElement;
  } => {
    const text = getChargeTypeName(__typename);
    let icon = <Coin />; // Default icon
    switch (__typename) {
      case 'CommonCharge':
        icon = <Coin />;
        break;
      case 'BusinessTripCharge':
        icon = <Plane />;
        break;
      case 'DividendCharge':
        icon = <Gift />;
        break;
      case 'ConversionCharge':
        icon = <Transform />;
        break;
      case 'SalaryCharge':
        icon = <Wallet />;
        break;
      case 'InternalTransferCharge':
        icon = <TransferIn />;
        break;
      case 'MonthlyVatCharge':
        icon = <ReceiptTax />;
        break;
      case 'BankDepositCharge':
        icon = <PigMoney />;
        break;
      case 'CreditcardBankCharge':
        icon = <CreditCard />;
        break;
      case 'FinancialCharge':
        icon = <Scale />;
        break;
    }
    return {
      text,
      icon,
    };
  }, [__typename]);
  return (
    <td>
      <div>{text}</div>
      <ThemeIcon radius="xl" size="xl">
        {icon}
      </ThemeIcon>
    </td>
  );
};
