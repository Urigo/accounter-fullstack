import { CSSProperties } from 'react';
import {
  businessesWithoutTaxCategory,
  businessesWithoutVAT,
  entitiesWithoutInvoice,
  SuggestedCharge,
} from '../../../helpers';
import gql from 'graphql-tag';
import { Currency, VatFieldsFragment } from '../../../__generated__/types';

gql`
  fragment VatFields on Charge {
    vat {
      raw
      formatted
      currency
    }
    transactions {
      id
      amount {
        raw
        currency
      }
    }
  }
`;

type Props = {
  isBusiness: boolean;
  financialEntityName: string;
  data: VatFieldsFragment;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Vat = ({ isBusiness, financialEntityName, data, alternativeCharge, style }: Props) => {
  const { vat, transactions } = data;
  const { raw: amount, currency } = transactions[0]?.amount || { raw: 0, currency: Currency.Nis };

  const indicator =
    (!vat?.raw &&
      isBusiness &&
      !entitiesWithoutInvoice.includes(financialEntityName) &&
      currency === Currency.Nis &&
      !businessesWithoutVAT.includes(financialEntityName) &&
      !businessesWithoutTaxCategory.includes(financialEntityName)) ||
    (vat?.raw && ((vat.raw > 0 && amount < 0) || (vat.raw < 0 && amount > 0)));

  const cellText = vat?.formatted ?? alternativeCharge?.vat?.formatted;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {/* {!transaction.vat && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'vat'}
          value={cellText?.toString()}
        />
      )} */}
      {/* <UpdateButton
        transaction={transaction}
        propertyName={'vat'}
        promptText="New VAT:"
      /> */}
    </td>
  );
};
